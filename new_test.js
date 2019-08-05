var pdfFiller = require('./index.js');
const fs = require('fs');

var sourcePDF = './resources/pdf/antrag_auf_einstellung.pdf';

// Override the default field name regex. Default: /FieldName: ([^\n]*)/
var nameRegex = null;

//pdfFiller.generateFDFTemplate(sourcePDF, function(err, fdfData) {
//  if (err) throw err;
//console.log(fdfData);
//});

const testFolder = './resources/pdf/';
const destination = './resources/filled/fieldPageMap.json';

const child_process = require('child_process');
const execFile = require('child_process').execFile;
//generateKeyMap();
test();
filForm();

async function test() {
  try {
    const newSource = await removeDefaultPassword(sourcePDF);
    const result = await pdfFiller.generateFDFTemplate(newSource);
    console.log('penis' + JSON.stringify(result));
  } catch (error) {
    console.error(error);
  }
}

function generateKeyMap() {
  fs.readdirSync(testFolder).forEach(async file => {
    try {
      const uri = `./resources/${file}`;
      const newSource = await removeDefaultPassword(uri);
      const fieldJson = await pdfFiller.generateFieldJson(newSource);
      console.log(JSON.stringify(fieldJson));
      fileName = file.split('.pdf')[0];
      appendData(fileName, fieldJson);
    } catch (error) {
      console.log(error);
    }
  });
}

function filForm() {
  const cb = function () { console.log("finished") }
  const fieldValues = {
    "Wer soll als Hilfskraft beschäftigt werden": "Mutter"
  }
  pdfFiller.fillForm('./resources/pdf/antrag_auf_einstellung_new.pdf', './resources/pdf/antrag_auf_einstellung_filled.pdf', fieldValues, cb)
}

async function appendData(fileName, fileData) {
  try {
    const storedData = await readFile(destination);
    obj = JSON.parse(storedData); //now it an object
    obj[fileName] = fileData; //add some data
    json = JSON.stringify(obj); //convert it back to json
    await writeFile(destination, json);
    console.log('Sucessfully written ' + fileName);
  } catch (error) {
    console.log(error);
  }
}

function writeFile(destination, data) {
  return new Promise((resolve, reject) => {
    fs.writeFile(destination, data, 'utf-8', function (err) {
      if (err) reject(err);
      else resolve(data);
    });
  });
}

function readFile(source) {
  return new Promise((resolve, reject) => {
    fs.readFile(source, 'utf-8', function (err, data) {
      if (err) reject(err);
      else resolve(data);
    });
  });
}

function removeDefaultPassword(sourceFile) {
  return new Promise((resolve, reject) => {
    const destiationFile = sourceFile.split('.pdf').join('_new.pdf');
    const args = ['--decrypt', sourceFile, destiationFile];
    execFile('qpdf', args, function (error, stdout, stderr) {
      if (error) reject(error);
      if (stderr) reject(stderr);
      resolve(destiationFile);
    });
  });
}
