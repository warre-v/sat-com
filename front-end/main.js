let port;
let writer;

document.getElementById('TakeImageButton').addEventListener('click', async () => {
    try {
        // Request the user to select a serial port
        port = await navigator.serial.requestPort();
        await port.open({ baudRate: 9600 }); // Adjust baud rate as needed

        // Set up the writer
        writer = port.writable.getWriter();

        console.log('Serial connection established.');

        // Send data
        await sendData('#TIMG');

    } catch (err) {
        console.error('Failed to open serial connection:', err);
        document.getElementById('status').textContent = 'Status: Failed to Connect';
    }

    if (port) {
        try {
            // Release the writer
            if (writer) {
                await writer.close();
                writer = null;
            }

            // Close the serial port
            await port.close();

            console.log('Serial connection closed.');

        } catch (err) {
            console.error('Failed to close serial connection:', err);
        }
    }
});

async function sendData(data) {
    if (writer) {
        try {
            const textEncoder = new TextEncoder();
            await writer.write(textEncoder.encode(data + '\n')); // Append newline character if needed
            console.log(`Sending: ${data}`);
        } catch (err) {
            console.error('Failed to send data:', err);
        }
    } else {
        console.warn('Writer is not initialized. Unable to send data.');
    }
}
