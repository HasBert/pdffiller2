/*
 *   File:       index.js (pdffiller)
 *   Project:    PDF Filler
 *   Date:       February 2019.
 *
 *   Description: This PDF filler module takes a data set and creates a filled out
 *                PDF file with the form fields populated.
 */
(function () {
    const child_process = require('child_process');
    const execFile = require('child_process').execFile;
    const fdf = require('./utf8-fdf');
    const _ = require('lodash');
    const fs = require('fs');

    const pdffiller = {
        mapForm2PDF: function (formFields, convMap) {
            let tmpFDFData = this.convFieldJson2FDF(formFields);
            tmpFDFData = _.mapKeys(tmpFDFData, function (value, key) {
                return convMap[key] ? convMap[key] : key;
            });

            return tmpFDFData;
        },

        convFieldJson2FDF: function (fieldJson) {
            return new Promise((resolve, reject) => {
                try {
                    const _keys = _.map(fieldJson, 'FieldName');
                    let _values = _.map(fieldJson, 'FieldValue');

                    _values = _.map(_values, function (val) {
                        if (val === true) return 'Yes';
                        else if (val === false) return 'Off';
                        else if (val === undefined) return '';
                        return val;
                    });

                    const jsonObj = _.zipObject(_keys, _values);
                    resolve(jsonObj);
                } catch (error) {
                    reject(error);
                }
            });
        },

        removeDefaultPassword: function (sourceFile) {
            return new Promise((resolve, reject) => {
                const destiationFile = sourceFile.split('.pdf').join('_no_passwd.pdf');
                const args = ['--decrypt', sourceFile, destiationFile];
                execFile('qpdf', args, function (error, stdout, stderr) {
                    if (error) reject(error);
                    if (stderr) reject(stderr);
                    resolve(destiationFile);
                });
            });
        },

        hasDefaultPassword: function (sourceFile) {
            return new Promise((resolve, reject) => {
                const args = [sourceFile, 'dump_data_fields_utf8'];
                execFile('pdftk', args, function (error, stdout, stderr) {
                    if (stdout) {
                        console.log(`${sourceFile} has NO default password!`)
                        resolve(false);
                    }
                    else if (error.message.includes('OWNER PASSWORD REQUIRED')) {
                        console.log(`${sourceFile} has default password!`)
                        resolve(true)
                    }
                    else {
                        reject(error)
                    }
                })
            })
        },

        generateFieldJson: function (sourceFile) {
            return new Promise(async (resolve, reject) => {
                // check if pdf has a default password, if ture change it.
                try {
                    if (await this.hasDefaultPassword(sourceFile)) {
                        sourceFile = await this.removeDefaultPassword(sourceFile)
                    }
                } catch (error) {
                    reject(error)
                }

                // read the given pdf
                const args = [sourceFile, 'dump_data_fields_utf8'];
                execFile('pdftk', args, function (error, stdout, stderr) {
                    if (error) reject(error)

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

                    resolve(fieldArray);
                });
            });
        },

        generateFDFTemplate: function (sourceFile) {
            return new Promise(async (resolve, reject) => {
                try {
                    const fieldJson = await this.generateFieldJson(sourceFile);
                    const jsonData = await this.convFieldJson2FDF(fieldJson);
                    resolve(jsonData);
                } catch (error) {
                    reject(error);
                }
            });
        },

        fillFormWithOptions: function (
            sourceFile,
            destinationFile,
            fieldValues,
            shouldFlatten,
            tempFDFPath,
            callback
        ) {
            //Generate the data from the field values.
            const randomSequence = Math.random()
                .toString(36)
                .substring(7);
            const currentTime = new Date().getTime();
            let tempFDFFile = `temp_data${currentTime}${randomSequence}.fdf`;
            const tempFDF =
                typeof tempFDFPath !== 'undefined'
                    ? `${tempFDFPath}/${tempFDFFile}`
                    : tempFDFFile;
            console.log(tempFDF)
            fdf.generator(fieldValues, tempFDF);
            fs.readFile(tempFDF, 'utf-8', function (err, data) {
                //if (err) reject(err);
                console.log(data);
            })
            //console.log('Form Data ' + formData);

            let args = [sourceFile, 'fill_form', tempFDF, 'output', destinationFile];
            if (shouldFlatten) {
                args.push('flatten');
            }
            execFile('pdftk', args, function (error, stdout, stderr) {
                if (error) {
                    console.log('exec error: ' + error);
                    return callback(error);
                }
                //Delete the temporary fdf file.
                fs.unlink(tempFDF, function (err) {
                    if (err) {
                        return callback(err);
                    }
                    // console.log( 'Sucessfully deleted temp file ' + tempFDF );
                    return callback();
                });
            });
        },

        fillFormWithFlatten: function (
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

        fillForm: function (sourceFile, destinationFile, fieldValues, callback) {
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

function readFile(source) {
    return new Promise((resolve, reject) => {
        fs.readFile(source, 'utf-8', function (err, data) {
            if (err) reject(err);
            else resolve(data);
        });
    });
}
