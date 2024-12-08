let port;
let writer;
let reader;
let receivedData = [];
let collectingData = false;
let partialData = '';
let isCollectingImage = false;
let imageData = '';
let buffer = ''; // Buffer to store incoming data
let delta = 0; // Delta to keep track of buffer length

document.getElementById('OpenConnectionButton').addEventListener('click', async (event) => {
    event.preventDefault();
    await openSerialConnection();
});

document.getElementById('TakeImageButton').addEventListener('click', async (event) => {
    event.preventDefault();

    if (writer) {
        // Clear imageData and buffer
        imageData = '';
        buffer = '';
        await sendData('#TIMG');
    } else {
        console.error('Writer is not initialized. Unable to send data.');
    }
});

document.getElementById('CloseConnectionButton').addEventListener('click', async (event) => {
    event.preventDefault();
    await closeSerialConnection();
});

async function openSerialConnection() {
    try {
        port = await navigator.serial.requestPort();
        await port.open({ baudRate: 9600 }); // Adjust baud rate as needed
        writer = port.writable.getWriter();
        reader = port.readable.getReader();

        console.log('Serial connection established.');

        // Start listening for incoming data
        listenToPort(reader);

        // Add a short delay to ensure the connection is fully established
        await new Promise(resolve => setTimeout(resolve, 500));

    } catch (err) {
        console.error('Failed to open serial connection:', err);
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

                // Limit buffer size to 128 characters
                if (buffer.length > 2048) {
                    buffer = buffer.slice(-2048);
                }

                // Hex representation of markers with extra 00 byte
                const startMarkerHex = '23494D475300'; // #IMGS00
                const endMarkerHex = '23494D474500';   // #IMGE00

                // Check for image start marker
                if (!isCollectingImage && buffer.includes(startMarkerHex)) {
                    console.log('Image start marker found');
                    isCollectingImage = true;
                    imageData = '';
                    // Remove everything up to and including start marker from buffer
                    buffer = buffer.substring(buffer.indexOf(startMarkerHex) + startMarkerHex.length);
                }

                // Collect image data if in between markers
                if (isCollectingImage) {
                    imageData += buffer;
                    buffer = '';

                    console.log(imageData.slice(-64));
                    // Check the last 64 characters of imageData for the end marker
                    if (imageData.slice(-64).includes(endMarkerHex)) {
                        console.log('Image end marker found');
                        // Extract image data up to end marker
                        const imageEndIndex = imageData.indexOf(endMarkerHex);
                        const finalImageData = imageData.substring(0, imageEndIndex);
                        isCollectingImage = false;
                        // Send collected image data to server
                        await sendImageToServer(finalImageData);
                        // Clear imageData after sending
                        imageData = '';
                    }
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
        // Clean the hex string - remove any whitespace, newlines etc
        const cleanHex = hexData.replace(/[\s\n\r]/g, '');
        console.log('Clean hex data:', cleanHex);
        
        const response = await fetch('http://localhost:5000/upload', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/octet-stream'
            },
            body: cleanHex
        });

        const result = await response.json();
        console.log('Server response:', result);
    } catch (error) {
        console.error('Error sending image to server:', error);
    }
}

