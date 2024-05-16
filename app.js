const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const morgan = require('morgan');

const app = express();
const port = 3000;

app.use(morgan('dev'));
app.use(express.static('public'));
app.use(express.json());

const directoryPath = './'; // Root folder

app.get('/', async (req, res) => {
    const filePath = path.join(__dirname, 'public', 'index.html');
    try {
        const content = await fs.readFile(filePath, 'utf-8');
        res.status(200).send(content);
    } catch (err) {
        res.status(404).send('404 Not Found');
    }
});

// Endpoint to compare key
app.post('/compareKey', async (req, res) => {
    const { key } = req.body;

    try {
        const data = await fs.readFile(path.join(__dirname, 'key.txt'), 'utf-8');
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
        const files = await fs.readdir(directoryPath);
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
        await fs.writeFile(path.join(directoryPath, filename), '');
        return res.json({ message: 'File created successfully', filename });
    } catch (err) {
        return res.status(500).json({ error: 'Error creating file' });
    }
});

// Endpoint to manipulate JSONL file data
app.post('/manipulate/:filename', async (req, res) => {
    const { index, uuid, attributes, values } = req.body;
    const filename = req.params.filename;
    const filePath = path.join(directoryPath, filename);

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
    const filePath = path.join(directoryPath, filename);

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
    const filePath = path.join(directoryPath, filename);

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
