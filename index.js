const express = require("express");
const puppeteer = require("puppeteer");
const uuid = require("uuid");
const fs = require("fs");
const path = require("path");
const process = require("process");
const app = express();
const port = process.env.PDFR_PORT ? process.env.PDFR_PORT : 3003;
const cleanupMinutes = process.env.PDFR_CLEANUP_MINUTES
  ? process.env.PDFR_CLEANUP_MINUTES
  : 60;
const verbose = process.env.PDFR_VERBOSE ? process.env.PDFR_VERBOSE : false;
const pdfDir = "pdfs";
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

app.get("/", (req, res) => {
  if (!browserAvailable) {
    res.status(424);
    res.json({
      message: "Waiting on browser starting - try again",
      filename: null
    });
    return;
  }
  const url = req.query.url;
  if (!url) {
    res.status(422);
    res.json({ message: "No url supplied", filename: null });
    if (verbose) {
      console.log("No url supplied with request");
    }
    return;
  }
  generatePdfFromUrl(url)
    .then(filename => {
      res.json({ filename: `pdf/${filename}`, message: "OK" });
    })
    .catch(err => {
      console.error(err);
      res.status(500);
      res.json({ message: "Error!", filename: null });
    });
});

app.post("/", (req, res) => {
  if (!browserAvailable) {
    res.status(424);
    res.json({
      message: "Waiting on browser starting - try again",
      filename: null
    });
    return;
  }
  if (!req.body.html) {
    res.status(422);
    res.json({ message: "Missing html parameter!", filename: null });
    if (verbose) {
      console.log("No html supplied with request");
    }
    return;
  }
  generatePdfFromHtml(req.body.html)
    .then(filename => {
      res.json({ filename: `pdf/${filename}`, message: "OK" });
    })
    .catch(err => {
      console.error(err);
      res.status(500);
      res.json({ message: "Error!", filename: null });
    });
});

app.get("/pdf/:filename", (req, res) => {
  if (!fs.existsSync(`${pdfDir}/${req.params.filename}`)) {
    res.status(404);
    res.end();
    return;
  }
  if (verbose) {
    console.log(`Downloading ${req.params.filename}`);
  }
  res.sendFile(path.join(__dirname, `${pdfDir}/${req.params.filename}`));
});

app.listen(port, () => console.log(`PDFR listening on port ${port}!`));
