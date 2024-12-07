let port;
let writer;
let reader;
let receivedData = [];
let collectingData = false;
let partialData = '';
let collectedData = ''; // Add this variable to store incoming data

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

document.getElementById('DownloadDataButton').addEventListener('click', () => {
    downloadData();
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

async function listenToPort(reader) {
    try {
        while (true) {
            const { value, done } = await reader.read();
            if (done) {
                // Reader has been canceled.
                break;
            }
            if (value) {
                const textDecoder = new TextDecoder();
                const data = textDecoder.decode(value);
                console.log('Received data:', data);
                collectedData += data; // Append data to the collectedData variable
            }
        }
    } catch (error) {
        console.error('Error reading from port:', error);
    } finally {
        reader.releaseLock();
    }
}

function downloadData() {
    const blob = new Blob([collectedData], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'received_data.txt';
    link.click();
    URL.revokeObjectURL(url);
}


