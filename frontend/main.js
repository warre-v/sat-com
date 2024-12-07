let port;
let writer;
let reader;
let receivedData = [];
let collectingData = false;
let partialData = '';
let isCollectingImage = false;
let imageData = '';
let buffer = ''; // Buffer to store incoming data

document.getElementById('OpenConnectionButton').addEventListener('click', async (event) => {
    event.preventDefault();
    await openSerialConnection();
});

document.getElementById('TakeImageButton').addEventListener('click', async (event) => {
    event.preventDefault();

    if (writer) {
        await sendData('#TIMG');
    } else {
        console.error('Writer is not initialized. Unable to send data.');
        document.getElementById('status').textContent = 'Status: Writer not initialized';
    }
});

document.getElementById('CloseConnectionButton').addEventListener('click', async (event) => {
    event.preventDefault();
    await closeSerialConnection();
});

document.getElementById('DownloadDataButton').addEventListener('click', () => {
    downloadData();
});

async function openSerialConnection() {
    try {
        port = await navigator.serial.requestPort();
        await port.open({ baudRate: 9600 }); // Adjust baud rate as needed
        writer = port.writable.getWriter();
        reader = port.readable.getReader();

        console.log('Serial connection established.');
        document.getElementById('status').textContent = 'Status: Connected';

        // Start listening for incoming data
        listenToPort(reader);

        // Add a short delay to ensure the connection is fully established
        await new Promise(resolve => setTimeout(resolve, 500));

    } catch (err) {
        console.error('Failed to open serial connection:', err);
        document.getElementById('status').textContent = 'Status: Failed to Connect';
    }
}

async function closeSerialConnection() {
    if (port) {
        try {
            // Release the writer
            if (writer) {
                await writer.close();
                writer = null;
            }

            // Release the reader
            if (reader) {
                await reader.cancel();
                reader = null;
            }

            // Close the serial port
            await port.close();
            port = null;

            console.log('Serial connection closed.');
            document.getElementById('status').textContent = 'Status: Disconnected';

        } catch (err) {
            console.error('Failed to close serial connection:', err);
        }
    }
}

async function sendData(data) {
    if (writer) {
        try {
            const textEncoder = new TextEncoder();
            const encodedData = textEncoder.encode(data + '\n');
            await writer.write(encodedData);
            console.log(`Data sent: ${data}`);
            document.getElementById('status').textContent = `Status: Sending ${data}`;
        } catch (err) {
            console.error('Failed to send data:', err);
        }
    } else {
        console.warn('Writer is not initialized. Unable to send data.');
    }
}

async function listenToPort(reader) {
    try {
        while (true) {
            const { value, done } = await reader.read();
            if (done) break;

            if (value) {
                const data = new TextDecoder().decode(value);

                // Append data to buffer
                buffer += data;

                // Check for image start marker
                if (!isCollectingImage && buffer.includes('#IMGS')) {
                    console.log('Image start marker found');
                    isCollectingImage = true;
                    imageData = '';
                    // Remove everything up to and including '#IMGS' from buffer
                    buffer = buffer.substring(buffer.indexOf('#IMGS') + 5);
                }

                // Check for image end marker
                if (isCollectingImage && buffer.includes('#IMGE')) {
                    console.log('Image end marker found');
                    // Extract image data up to '#IMGE'
                    const imageEndIndex = buffer.indexOf('#IMGE');
                    imageData += buffer.substring(0, imageEndIndex);
                    // Remove image data and marker from buffer
                    buffer = buffer.substring(imageEndIndex + 5);
                    isCollectingImage = false;

                    // Send collected image data to server
                    await sendImageToServer(imageData);
                }

                // Collect image data if in between markers
                if (isCollectingImage && buffer.length >= 32) {
                    // Take all data from buffer and add to imageData
                    console.log('Received:', buffer);
                    imageData += buffer;
                    buffer = '';
                }
            }
        }
    } catch (error) {
        console.error('Error reading from port:', error);
    } finally {
        reader.releaseLock();
    }
}

async function sendImageToServer(hexData) {
    try {
        // Convert hex string to binary data
        const bytes = new Uint8Array(hexData.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
        
        const response = await fetch('http://localhost:5000/upload', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/octet-stream'
            },
            body: bytes
        });

        const result = await response.json();
        console.log('Server response:', result);
        document.getElementById('status').textContent = 'Status: Image uploaded to server';
    } catch (error) {
        console.error('Error sending image to server:', error);
        document.getElementById('status').textContent = 'Status: Failed to upload image';
    }
}

