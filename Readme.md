# PDFR

Very simple node API to generate PDF's using [Puppeteer](https://github.com/puppeteer/puppeteer/).

## Usage

Assuming you have node installed :
```bash
npm install
npm index.js
```

Then you can call :
```
GET http://localhost:3003/?url=http://www.google.com # generate a pdf of a website
POST http://localhost:3003 # generate a pdf from html
```
The POST version expects a regular html form-encoded input of `html` with the contents you want rendered out. Each call will return a JSON response
of the form :
```json
{
    "message": "Some info",
    "filename": "pdf/some-long-uuid.pdf"
}
```
You can then call a regular GET to `http://localhost:3003/pdf/some-long-uuid.pdf` to grab the file.  PDF's are deleted after one hour by default.

## Options

You can set a couple of environment variables to change the behaviour.
```
PDFR_VERBOSE=1 - more log outout
PDFR_PORT=1234 - the port the app will listen on
PDFR_CLEANUP_MINUTES=60 - the number of minutes before a pdf is deleted
```
