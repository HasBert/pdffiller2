/*
 *   File:       index.js (pdffiller)
 *   Project:    PDF Filler
 *   Date:       February 2019.
 *
 *   Description: This PDF filler module takes a data set and creates a filled out
 *                PDF file with the form fields populated.
 */
(function() {
  const child_process = require('child_process');
  const execFile = require('child_process').execFile;
  const fdf = require('utf8-fdf-generator');
  const _ = require('lodash');
  const fs = require('fs');

  const pdffiller = {
    mapForm2PDF: function(formFields, convMap) {
      let tmpFDFData = this.convFieldJson2FDF(formFields);
      tmpFDFData = _.mapKeys(tmpFDFData, function(value, key) {
        try {
          convMap[key];
        } catch (err) {
          return key;
        }
        return convMap[key];
      });

      return tmpFDFData;
    },

    convFieldJson2FDF: function(fieldJson) {
      let _keys = _.map(fieldJson, 'title'),
        _values = _.map(fieldJson, 'fieldValue');

      _values = _.map(_values, function(val) {
        return val === true ? 'Yes' : 'Off';
      });

      let jsonObj = _.zipObject(_keys, _values);

      return jsonObj;
    },

    generateFieldJson: function(sourceFile, nameRegex, callback) {
      execFile('pdftk', [sourceFile, 'dump_data_fields_utf8'], function(
        error,
        stdout,
        stderr
      ) {
        if (error) {
          console.log('exec error: ' + error);
          return callback(error, null);
        }

        fields = stdout.split('---').slice(1);

        fieldArray = fields.reduce((jsonFields, stringLine) => {
          const jsonField = stringLine
            .split('\n')
            .map(keyValueString => keyValueString.split(':'))
            .filter(splitted => splitted[1])
            .reduce((field, splitted) => {
              const key = splitted[0];
              const value = splitted[1].trim();
              // if there is already a value assigned to the key, then we place
              // that value inside an array, if there is already an array, then
              // we append the value.
              if (field[key]) {
                if (Array.isArray(field[key])) {
                  field[key].push(value);
                } else {
                  field[key] = [field[key]];
                }
              } else {
                field[key] = value;
              }
              return field;
            }, {});
          jsonFields.push(jsonField);
          return jsonFields;
        }, []);

        return callback(null, fieldArray);
      });
    },

    generateFDFTemplate: function(sourceFile, nameRegex, callback) {
      this.generateFieldJson(
        sourceFile,
        nameRegex,
        function(err, _form_fields) {
          if (err) {
            console.log('exec error: ' + err);
            return callback(err, null);
          }

          return callback(null, this.convFieldJson2FDF(_form_fields));
        }.bind(this)
      );
    },

    fillFormWithOptions: function(
      sourceFile,
      destinationFile,
      fieldValues,
      shouldFlatten,
      tempFDFPath,
      callback
    ) {
      //Generate the data from the field values.
      let randomSequence = Math.random()
        .toString(36)
        .substring(7);
      let currentTime = new Date().getTime();
      let tempFDFFile = 'temp_data' + currentTime + randomSequence + '.fdf',
        tempFDF =
          typeof tempFDFPath !== 'undefined'
            ? tempFDFPath + '/' + tempFDFFile
            : tempFDFFile,
        formData = fdf.generator(fieldValues, tempFDF);

      let args = [sourceFile, 'fill_form', tempFDF, 'output', destinationFile];
      if (shouldFlatten) {
        args.push('flatten');
      }
      execFile('pdftk', args, function(error, stdout, stderr) {
        if (error) {
          console.log('exec error: ' + error);
          return callback(error);
        }
        //Delete the temporary fdf file.
        fs.unlink(tempFDF, function(err) {
          if (err) {
            return callback(err);
          }
          // console.log( 'Sucessfully deleted temp file ' + tempFDF );
          return callback();
        });
      });
    },

    fillFormWithFlatten: function(
      sourceFile,
      destinationFile,
      fieldValues,
      shouldFlatten,
      callback
    ) {
      this.fillFormWithOptions(
        sourceFile,
        destinationFile,
        fieldValues,
        shouldFlatten,
        undefined,
        callback
      );
    },

    fillForm: function(sourceFile, destinationFile, fieldValues, callback) {
      this.fillFormWithFlatten(
        sourceFile,
        destinationFile,
        fieldValues,
        true,
        callback
      );
    }
  };

  module.exports = pdffiller;
})();
