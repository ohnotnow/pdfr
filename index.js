const express = require("express");
const puppeteer = require("puppeteer");
const uuid = require("uuid");
const fs = require("fs");
const path = require("path");
const process = require("process");
const port = process.env.PDFR_PORT ? process.env.PDFR_PORT : 3003;
const cleanupMinutes = process.env.PDFR_CLEANUP_MINUTES
  ? process.env.PDFR_CLEANUP_MINUTES
  : 60;
const verbose = process.env.PDFR_VERBOSE ? process.env.PDFR_VERBOSE : false;
const pdfDir = "pdfs";
const app = express();
let browser;
let page;
let browserAvailable = false;

app.use(express.urlencoded({ extended: true }));

if (!fs.existsSync(pdfDir)) {
  fs.mkdirSync(pdfDir);
}

process.once("SIGINT", function(code) {
  console.log("Exiting on SIGINT...");
  shutDown();
});

process.once("SIGTERM", function(code) {
  console.log("Exiting on SIGTERM...");
  shutDown();
});

function shutDown() {
  closeBrowser();
  process.exit();
}

(async () => {
  console.log("Starting browser");
  browser = await puppeteer.launch();
  console.log("Opening initial page");
  page = await browser.newPage();
  console.log("Browser available");
  browserAvailable = true;
})();

function removeOldFiles() {
  console.log("Removing old PDFs");
  const dirname = path.join(__dirname, pdfDir);
  const now = new Date().getTime();
  const cleanupTime = cleanupMinutes * 60 * 60 * 1000;
  fs.readdir(dirname, function(err, files) {
    if (err) {
      return console.log("Unable to scan directory: " + err);
    }
    files.forEach(function(file) {
      fs.stat(`${pdfDir}/${file}`, (err, stat) => {
        if (err) throw err;
        const timeDiff = Math.abs(now - stat.ctime.getTime());
        if (timeDiff > cleanupTime) {
          fs.unlink(`${pdfDir}/${file}`, err => {
            if (err) throw err;
            console.log(`Deleted ${file}`);
          });
        }
      });
    });
  });
}

setInterval(removeOldFiles, 5 * 60 * 1000);

async function generatePdfFromUrl(url) {
  const filename = `${uuid.v4()}.pdf`;
  console.log(`Generating PDF from URL ${verbose ? url : ""}`);
  await page.goto(url, { waitUntil: "networkidle2" });
  await page.pdf({ path: `${pdfDir}/${filename}`, format: "A4" });
  return filename;
}

async function generatePdfFromHtml(html) {
  const filename = `${uuid.v4()}.pdf`;
  console.log(
    `Generating PDF from HTML ${verbose ? html.substring(0, 50) : ""}`
  );
  await page.setContent(html, { waitUntil: "networkidle2" });
  await page.pdf({ path: `${pdfDir}/${filename}`, format: "A4" });
  return filename;
}

async function closeBrowser() {
  await browser.close();
}

function sendErrorResponse(res, message, status) {
  res.status(status);
  res.json({ message: message, filename: null });
  if (verbose) {
    console.log(message);
  }
}

app.get("/", (req, res) => {
  if (!browserAvailable) {
    return sendErrorResponse(res, "Waiting on browser starting - try again", 424);
  }
  const url = req.query.url;
  if (!url) {
    return sendErrorResponse(res, "No url supplied", 422);
  }
  generatePdfFromUrl(url)
    .then(filename => {
      res.json({ filename: `pdf/${filename}`, message: "OK" });
    })
    .catch(err => {
      console.error(err);
      return sendErrorResponse(res, "Server Error", 500);
    });
});

app.post("/", (req, res) => {
  if (!browserAvailable) {
    return sendErrorResponse(res, "Waiting on browser starting - try again", 424);
  }
  if (!req.body.html) {
    return sendErrorResponse(res, "Missing html parameter", 422);
  }
  generatePdfFromHtml(req.body.html)
    .then(filename => {
      res.json({ filename: `pdf/${filename}`, message: "OK" });
    })
    .catch(err => {
      console.error(err);
      return sendErrorResponse(res, "Server Error", 500);
    });
});

app.get("/pdf/:filename", (req, res) => {
  if (!fs.existsSync(`${pdfDir}/${req.params.filename}`)) {
    return sendErrorResponse(res, "Not found", 404);
  }
  if (verbose) {
    console.log(`Downloading ${req.params.filename}`);
  }
  res.sendFile(path.join(__dirname, `${pdfDir}/${req.params.filename}`));
});

app.listen(port, () => console.log(`PDFR listening on port ${port}!`));
