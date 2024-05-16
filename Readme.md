### Base URL
The base URL for accessing the server's endpoints is `http://your_server_address`

### 1. Create a new JSONL file
- **Endpoint:** `POST /create`
- **Request Body:** 
  ```json
  {
      "filename": "your_file_name.jsonl"
  }
  ```
- **Response:**
  - 200 OK: File created successfully
  - 400 Bad Request: If filename is not provided
  - 500 Internal Server Error: If there's an error creating the file

### 2. Check for existing JSONL files
- **Endpoint:** `GET /check`
- **Response:**
  - 200 OK: List of existing JSONL files in the root directory
  ```json
  {
      "files": ["file1.jsonl", "file2.jsonl", ...]
  }
  ```
  - 404 Not Found: If the root directory doesn't exist
  - 500 Internal Server Error: If there's an error reading the directory

### 3. Manipulate data within a JSONL file
- **Endpoint:** `POST /manipulate/:filename`
- **Path Parameter:** `filename` - The name of the JSONL file to manipulate
- **Request Body:** 
  - `index` (optional): Index of the record to manipulate
  - `uuid` (optional): Unique identifier of the record to manipulate
  - `attributes`: Array of attributes to update
  - `values`: Array of corresponding values for the attributes
- **Response:**
  - 200 OK: File updated successfully
  ```json
  {
      "message": "File updated successfully",
      "newIndex": newIndex // Index of the updated record (if applicable)
  }
  ```
  - 500 Internal Server Error: If there's an error reading or writing to the file

### 4. Read the content of a JSONL file
- **Endpoint:** `GET /read/:filename`
- **Path Parameter:** `filename` - The name of the JSONL file to read
- **Query Parameters:**
  - `id` (optional): Filter records by ID
  - `attribute` (optional): Retrieve specific attribute from each record
- **Response:**
  - 200 OK: Content of the JSONL file
  ```json
  [
      { "attribute1": "value1", "attribute2": "value2", ... },
      { "attribute1": "value1", "attribute2": "value2", ... },
      ...
  ]
  ```
  - 500 Internal Server Error: If there's an error reading the file

### 5. Remove records from a JSONL file
- **Endpoint:** `POST /remove/:filename`
- **Path Parameter:** `filename` - The name of the JSONL file to remove records from
- **Request Body:** 
  - `uuid` (optional): Unique identifier of the record to remove
  - `index` (optional): Index of the record to remove
  - `attribute` (optional): Attribute to remove from all records
- **Response:**
  - 200 OK: Records updated successfully
  ```json
  {
      "message": "Records updated successfully"
  }
  ```
  - 500 Internal Server Error: If there's an error reading or writing to the file

### Notes:
- All endpoints support JSON request and response bodies.
- Ensure proper error handling for responses with status codes 400, 404, and 500.