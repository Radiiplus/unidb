const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const morgan = require('morgan');
const AdmZip = require('adm-zip');
const { execSync } = require('child_process');
const readline = require('readline-sync');


const app = express();
const port = 4000;

app.use(morgan('dev'));
app.use(express.static('public'));
app.use(express.json());

const filesDirectory = './files'; // Folder for JSONL files

app.get('/', async (req, res) => {
    const filePath = path.join(__dirname, 'public', 'index.html');
    try {
        const content = await fs.readFile(filePath, 'utf-8');
        res.status(200).send(content);
    } catch (err) {
        res.status(404).send('404 Not Found');
    }
});

async function zipFiles(folderPath) {
    const zip = new AdmZip();

    try {
        // Read files in the folder
        const files = await fs.readdir(folderPath);

        // Add each file to the zip archive
        for (const file of files) {
            const filePath = path.join(folderPath, file);
            zip.addLocalFile(filePath);
        }

        // Save the zip archive
        const zipFilePath = path.join(folderPath, 'files.zip');
        zip.writeZip(zipFilePath);

        return zipFilePath;
    } catch (error) {
        console.error('Error zipping files:', error);
        throw error;
    }
}

// Function to post the zipped file to the specified endpoint using cURL
async function postZipFileWithCurl(zipFilePath, endpoint) {
    try {
        const curlCommand = `curl -X POST -F "file=@${zipFilePath}" ${endpoint}`;
        execSync(curlCommand);
        console.log('File uploaded successfully.');
    } catch (error) {
        console.error('Error uploading file:', error.message);
    }
}

app.post('/backup', async (req, res) => {
    const folderPath = filesDirectory;
    try {
        const zipFilePath = await zipFiles(folderPath);
        const endpoint = 'https://unicloud-adkw8trk.b4a.run/upload'; // Change this to your actual upload endpoint
        postZipFileWithCurl(zipFilePath, endpoint);
        return res.json({ message: 'Backup successful' });
    } catch (error) {
        return res.status(500).json({ error: 'Error creating zip file' });
    }
});

// Function to download a file from the specified endpoint and extract its contents
function restoreFiles(filename, downloadEndpoint, destinationFolder) {
    return new Promise((resolve, reject) => {
        try {
            // Download the file
            const curlCommand = `curl -o ${filename} ${downloadEndpoint}/${filename}`;
            execSync(curlCommand);
            console.log('File downloaded successfully.');

            // Extract the zip file
            const zip = new AdmZip(filename);
            zip.extractAllTo(destinationFolder, /*overwrite*/ true);
            console.log('Files extracted successfully.');

            // Delete the zip file after extraction
            fs.unlink(filename, (err) => {
                if (err) {
                    console.error('Error deleting zip file:', err.message);
                    reject(err);
                } else {
                    console.log('Zip file deleted.');
                    resolve();
                }
            });
        } catch (error) {
            console.error('Error restoring files:', error.message);
            reject(error);
        }
    });
}

// Endpoint to handle the restore request
app.post('/restore/:filename', async (req, res) => {
    const filename = req.params.filename;
    const downloadEndpoint = 'https://unicloud-adkw8trk.b4a.run/download'; // Replace with your actual download endpoint

    if (!filename) {
        return res.status(400).send('Filename is required');
    }

    try {
        // Restore the files
        await restoreFiles(filename, downloadEndpoint, filesDirectory);

        // Send success JSON response
        res.json({ success: true, message: 'Files restored successfully.' });
    } catch (error) {
        // Handle errors
        console.error('Error restoring files:', error.message);
        res.status(500).json({ success: false, error: 'Error restoring files' });
    }
});

// Endpoint to compare key
app.post('/compareKey', async (req, res) => {
    const { key } = req.body;

    try {
        const data = await fs.readFile(path.join(__dirname, 'key', 'key.txt'), 'utf-8');
        const storedKey = data.trim(); // Trim to remove any extra whitespace

        // Compare keys
        if (key === storedKey) {
            return res.json({ message: 'Key matched successfully' });
        } else {
            return res.status(401).json({ error: 'Unauthorized access' });
        }
    } catch (err) {
        return res.status(500).json({ error: 'Error reading key file' });
    }
});

// Endpoint to check for existing JSONL files
app.get('/check', async (req, res) => {
    try {
        const files = await fs.readdir(filesDirectory);
        const jsonlFiles = files.filter(file => path.extname(file) === '.jsonl');

        if (jsonlFiles.length === 0) {
            return res.json({ files: [] });
        } else {
            return res.json({ files: jsonlFiles });
        }
    } catch (err) {
        return res.status(500).json({ error: 'Error reading directory' });
    }
});

// Endpoint to create a new JSONL file
app.post('/create', async (req, res) => {
    const { filename } = req.body;
    if (!filename) {
        return res.status(400).json({ error: 'Filename is required' });
    }

    try {
        await fs.writeFile(path.join(filesDirectory, filename), '');
        return res.json({ message: 'File created successfully', filename });
    } catch (err) {
        return res.status(500).json({ error: 'Error creating file' });
    }
});

// Endpoint to manipulate JSONL file data
app.post('/manipulate/:filename', async (req, res) => {
    const { index, uuid, attributes, values } = req.body;
    const filename = req.params.filename;
    const filePath = path.join(filesDirectory, filename);

    try {
        const data = await fs.readFile(filePath, 'utf-8');
        let records = data ? data.split('\n').filter(line => line.trim() !== '').map(JSON.parse) : [];

        // Check if attributes are defined without a uuid
        if (!uuid && attributes && Array.isArray(attributes)) {
            // Update existing records with new attributes and values
            for (let i = 0; i < attributes.length; i++) {
                // Add attribute to all existing records
                records.forEach(record => {
                    // Check if the attribute already exists in the record
                    if (!record.hasOwnProperty(attributes[i])) {
                        // Check if the value is explicitly undefined
                        if (values[i] === undefined) {
                            // Save the attribute without any value
                            record[attributes[i]] = null;
                        } else {
                            record[attributes[i]] = values[i];
                        }
                    } else if (values[i] !== undefined && record[attributes[i]] !== values[i]) {
                        // Update attribute value if it's not undefined and different from existing value
                        record[attributes[i]] = values[i];
                    }
                });
            }

            // Update file with new data
            const newData = records.map(record => JSON.stringify(record)).join('\n');
            await fs.writeFile(filePath, newData);
            return res.json({ message: 'File updated successfully' });
        }

        // Check if a record with matching uuid exists
        const existingRecordIndex = records.findIndex(record => record.uuid === uuid);

        // If record with matching uuid exists
        if (existingRecordIndex !== -1) {
            const existingRecord = records[existingRecordIndex];

            // Check if attributes exist and update their values
            if (attributes && Array.isArray(attributes)) {
                for (let i = 0; i < attributes.length; i++) {
                    // Check if the attribute already exists in the record
                    if (!existingRecord.hasOwnProperty(attributes[i])) {
                        // Check if the value is explicitly undefined
                        if (values[i] === undefined) {
                            // Save the attribute without any value
                            existingRecord[attributes[i]] = null;
                        } else {
                            existingRecord[attributes[i]] = values[i];
                        }
                    } else if (values[i] !== undefined && existingRecord[attributes[i]] !== values[i]) {
                        // Update attribute value if it's not undefined and different from existing value
                        existingRecord[attributes[i]] = values[i];
                    }
                }
            }

            // Update file with updated data
            const newData = records.map(record => JSON.stringify(record)).join('\n');
            await fs.writeFile(filePath, newData);
            return res.json({ message: 'File updated successfully', newIndex: existingRecord.index });
        } else {
            // Auto index for new record
            const newIndex = records.length;
            const newRecord = { index: newIndex, uuid };

            // Add attributes to the new record
            if (attributes && Array.isArray(attributes)) {
                for (let i = 0; i < attributes.length; i++) {
                    // Check if the value is explicitly undefined
                    if (values[i] === undefined) {
                        // Save the attribute without any value
                        newRecord[attributes[i]] = null;
                    } else {
                        newRecord[attributes[i]] = values[i];
                    }
                }
            }

            // Add the new record to records array
            records.push(newRecord);

            // Update file with new data
            const newData = records.map(record => JSON.stringify(record)).join('\n');
            await fs.writeFile(filePath, newData);
            return res.json({ message: 'File updated successfully', newIndex });
        }
    } catch (err) {
        return res.status(500).json({ error: 'Error reading or writing to file' });
    }
});

// Endpoint to read the content of a JSONL file
app.get('/read/:filename', async (req, res) => {
    const { id, attribute } = req.query;
    const filename = req.params.filename;
    const filePath = path.join(filesDirectory, filename);

    try {
        const data = await fs.readFile(filePath, 'utf-8');
        let fileContent = data.split('\n')
                              .filter(line => line.trim() !== '')
                              .map(line => {
                                  try {
                                      return JSON.parse(line);
                                  } catch (e) {
                                      console.error(`Error parsing line: ${line}`, e);
                                      return null;
                                  }
                              })
                              .filter(obj => obj !== null); // Filter out parsing errors

        if (id) {
            fileContent = fileContent.filter(record => record.id === id);
        } else if (attribute) {
            fileContent = fileContent.map(record => ({ [attribute]: record[attribute] }));
        }

        return res.json(fileContent);
    } catch (err) {
        return res.status(500).json({ error: 'Error reading file' });
    }
});

app.post('/remove/:filename', async (req, res) => {
    const { uuid, index, attribute } = req.body;
    const filename = req.params.filename;
    const filePath = path.join(filesDirectory, filename);

    try {
        const data = await fs.readFile(filePath, 'utf-8');
        let records = data ? data.split('\n').filter(line => line.trim() !== '').map(JSON.parse) : [];

        // Remove an attribute and its value from all records
        if (attribute !== undefined) {
            records.forEach(record => {
                delete record[attribute];
            });
        }

        // Remove a record by UUID or index number
        if (uuid !== undefined || index !== undefined) {
            if (uuid !== undefined) {
                records = records.filter(record => record.uuid !== uuid);
            } else {
                records = records.filter(record => record.index !== parseInt(index));
            }
        }

        // Update file with new data
        const newData = records.map(record => JSON.stringify(record)).join('\n');
        await fs.writeFile(filePath, newData);
        return res.json({ message: 'Records updated successfully' });
    } catch (err) {
        return res.status(500).json({ error: 'Error reading or writing to file' });
    }
});

app.get('/:page', async (req, res) => {
    const { page } = req.params;
    const filePath = path.join(__dirname, 'public', `${page}.html`);
    try {
        const content = await fs.readFile(filePath, 'utf-8');
        res.status(200).send(content);
    } catch (err) {
        res.status(404).send('404 Not Found');
    }
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
