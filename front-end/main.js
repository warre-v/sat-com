let port;
let writer;
let reader;
let receivedData = [];
let collectingData = false;
let partialData = '';

document.getElementById('OpenConnectionButton').addEventListener('click', async (event) => {
    event.preventDefault();
    console.log('Open Connection button clicked');
    await openSerialConnection();
});

document.getElementById('TakeImageButton').addEventListener('click', async (event) => {
    event.preventDefault();
    console.log('Take Image button clicked');

    // Ensure the writer is ready before sending data
    if (writer) {
        console.log('Writer is ready. Sending data...');
        // Send data
        await sendData('#TIMG');
        // Start listening for data
        await listenForData();
    } else {
        console.error('Writer is not initialized. Unable to send data.');
        document.getElementById('status').textContent = 'Status: Writer not initialized';
    }
});

document.getElementById('CloseConnectionButton').addEventListener('click', async (event) => {
    event.preventDefault();
    console.log('Close Connection button clicked');
    await closeSerialConnection();
});

async function openSerialConnection() {
    try {
        console.log('Requesting serial port...');
        port = await navigator.serial.requestPort();
        console.log('Serial port selected.');

        console.log('Opening serial port...');
        await port.open({ baudRate: 9600 }); // Adjust baud rate as needed
        console.log('Serial port opened.');

        console.log('Setting up writer...');
        writer = port.writable.getWriter();
        console.log('Writer set up.');

        console.log('Setting up reader...');
        reader = port.readable.getReader();
        console.log('Reader set up.');

        console.log('Serial connection established.');
        document.getElementById('status').textContent = 'Status: Connected';

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
            console.log('Closing serial connection...');
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
            console.log('Encoding data...');
            const textEncoder = new TextEncoder();
            const encodedData = textEncoder.encode(data + '\n');
            console.log('Data encoded:', encodedData);

            console.log('Writing data to serial port...');
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

async function listenForData() {
    try {
        console.log('Listening for data...');
        let buffer = []; // Accumulates incoming bytes
        const startMarker = new TextEncoder().encode('#IMGS'); // Start marker bytes
        const endMarker = new TextEncoder().encode('#IMGE');   // End marker bytes
        let collectingData = false;

        while (true) {
            const { value, done } = await reader.read();
            if (done) {
                console.log('Stream closed');
                break;
            }

            if (value) {
                // Append incoming bytes to buffer
                buffer.push(...value);

                // Convert buffer to Uint8Array for searching
                const bufferArray = new Uint8Array(buffer);

                if (!collectingData) {
                    // Search for start marker
                    const startIndex = indexOfSubarray(bufferArray, startMarker);
                    if (startIndex !== -1) {
                        console.log('Start marker found');
                        collectingData = true;
                        // Remove data before the start marker
                        buffer = buffer.slice(startIndex + startMarker.length);
                    } else {
                        // Keep buffer from growing indefinitely
                        if (buffer.length > startMarker.length) {
                            buffer = buffer.slice(-startMarker.length);
                        }
                        continue; // Wait for start marker
                    }
                }

                if (collectingData) {
                    // Search for end marker
                    const bufferArray = new Uint8Array(buffer);
                    const endIndex = indexOfSubarray(bufferArray, endMarker);
                    if (endIndex !== -1) {
                        console.log('End marker found');
                        // Extract data up to end marker
                        const imageData = buffer.slice(0, endIndex);
                        console.log(`Collected ${imageData.length} bytes`);

                        // Send collected data to the server
                        await sendDataToPython(new Uint8Array(imageData));

                        // Reset flags and buffers
                        collectingData = false;
                        buffer = [];
                        break; // Exit loop if only expecting one image
                    }
                }
            }
        }
    } catch (err) {
        console.error('Failed to read data:', err);
    }
}

// Helper function to find a subarray within an array
function indexOfSubarray(haystack, needle) {
    for (let i = 0; i <= haystack.length - needle.length; i++) {
        let found = true;
        for (let j = 0; j < needle.length; j++) {
            if (haystack[i + j] !== needle[j]) {
                found = false;
                break;
            }
        }
        if (found) return i;
    }
    return -1;
}

async function sendDataToPython(data) {
    try {
        console.log('Sending data to Python script...');
        console.log('Data length:', data.length);
        const response = await fetch('http://localhost:5000/upload', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/octet-stream'
            },
            body: data
        });
        const result = await response.json();
        console.log('Data processed by Python script:', result);
    } catch (err) {
        console.error('Failed to send data to Python script:', err);
    }
}

