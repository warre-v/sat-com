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
let isConnected = false;

document.getElementById('OpenConnectionButton').addEventListener('click', async (event) => {
    event.preventDefault();
    if (!isConnected) {
        await openSerialConnection();
    } else {
        await closeSerialConnection();
    }
});

document.getElementById('TakeImageButton').addEventListener('click', async (event) => {
    event.preventDefault();
    if (isCollectingImage) return; // Prevent multiple clicks while collecting

    if (writer) {
        imageData = '';
        buffer = '';
        await sendData('#TIMG');
        updateTakeImageButton(true);
    } else {
        console.error('Writer is not initialized. Unable to send data.');
    }
});

document.getElementById('ShowImageButton').remove(); // Remove the button element

document.addEventListener('DOMContentLoaded', (event) => {
    fetchAndDisplayImage();
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

        isConnected = true;
        updateConnectionButton();

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

            isConnected = false;
            updateConnectionButton();

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

function updateSensorData(data) {
    const values = data.split(',');
    if (values[0] === '#DATA' && values.length === 11) {
        // Update position (magnetometer)
        document.getElementById('position').textContent = 
            `(${values[1]}, ${values[2]}, ${values[3]})`;
        
        // Update azimuth
        document.getElementById('azimuth').textContent = values[4];
        
        // Update angular acceleration
        document.getElementById('angularAcc').textContent = 
            `(${parseFloat(values[5])/100}, ${parseFloat(values[6]) / 100}, ${parseFloat(values[7]) / 100})`;
        
        // Update angular velocity
        document.getElementById('angularVel').textContent = 
            `(${parseFloat(values[8]) / 100}, ${parseFloat(values[9]) / 100}, ${parseFloat(values[10]) / 100})`;
        
        // Update CubeSat rotation based on azimuth
        rotateCubeSat(parseInt(values[4]));
    }
}

async function listenToPort(reader) {
    let partialLine = '';
    
    try {
        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            
            const textDecoder = new TextDecoder();
            const text = textDecoder.decode(value);
            
            const lines = (partialLine + text).split(/\r?\n/);
            partialLine = lines.pop() || '';
            
            for (const line of lines) {
                const trimmedLine = line.trim();
                if (!trimmedLine) continue;
                
                console.log('Serial received:', trimmedLine);
                
                if (trimmedLine.startsWith('#DATA')) {
                    updateSensorData(trimmedLine);
                }
                else if (trimmedLine === '#IMGS') {
                    console.log('Image start marker found');
                    isCollectingImage = true;
                    updateTakeImageButton(true);
                    imageData = '';
                } 
                else if (trimmedLine === '#IMGE') {
                    console.log('Image end marker found');
                    isCollectingImage = false;
                    updateTakeImageButton(false);
                    await sendImageToServer(imageData);
                    imageData = '';
                }
                else if (isCollectingImage && !trimmedLine.includes('#')) {
                    const hexLine = trimmedLine.replace(/\s+/g, '');
                    if (hexLine.length === 64) {
                        imageData += hexLine;
                    }
                }
            }
        }
    } catch (error) {
        console.error('Error reading from port:', error);
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

        if (result.status === 'success') {
            await fetchAndDisplayImage(); // Automatically fetch and display the image
        }
    } catch (error) {
        console.error('Error sending image to server:', error);
    }
}

async function fetchAndDisplayImage() {
    try {
        const response = await fetch('http://localhost:5000/get-image');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const blob = await response.blob();
        const imageUrl = URL.createObjectURL(blob);
        
        const img = document.getElementById('capturedImage');
        const placeholder = document.getElementById('imagePlaceholder');
        
        img.onload = () => {
            img.style.display = 'block';
            placeholder.style.display = 'none';
            URL.revokeObjectURL(imageUrl); // Clean up the URL object
        };
        
        img.onerror = () => {
            console.error('Error loading image');
            placeholder.textContent = 'Error loading image';
            URL.revokeObjectURL(imageUrl);
        };
        
        img.src = imageUrl;
    } catch (error) {
        console.error('Error fetching image:', error);
        const placeholder = document.getElementById('imagePlaceholder');
        placeholder.textContent = 'Failed to load image';
    }
}

function updateConnectionButton() {
    const button = document.getElementById('OpenConnectionButton');
    if (isConnected) {
        button.textContent = 'Close Connection';
        button.classList.remove('disconnected');
        button.classList.add('connected');
    } else {
        button.textContent = 'Open Connection';
        button.classList.remove('connected');
        button.classList.add('disconnected');
    }
}

function updateTakeImageButton(collecting) {
    const button = document.getElementById('TakeImageButton');
    if (collecting) {
        button.textContent = 'Taking Image...';
        button.classList.add('taking');
    } else {
        button.textContent = 'Take Image';
        button.classList.remove('taking');
    }
}

// Set up the chart data and configuration
let ctx = document.getElementById('realTimeGraph').getContext('2d');
let realTimeGraph = new Chart(ctx, {
    type: 'line',  // Line chart type
    data: {
        labels: [], // Time or other metrics labels
        datasets: [{
            label: 'Angular Velocity',
            data: [],  // Rotational speed data points
            borderColor: 'rgba(75, 192, 192, 1)',
            backgroundColor: 'rgba(75, 192, 192, 0.2)',
            fill: true,
        }]
    },
    options: {
        responsive: true,
        scales: {
            x: {
                type: 'linear',
                position: 'bottom',
                title: {
                    display: true,
                    text: 'Time (s)'
                }
            },
            y: {
                title: {
                    display: true,
                    text: 'Angular Velocity (rad/s)'
                }
            }
        }
    }
});

// Example of how to update the graph with real-time data
function updateGraph(newTime, newSpeed) {
    // Push new data to the graph
    realTimeGraph.data.labels.push(newTime);  // Update with current time or metric
    realTimeGraph.data.datasets[0].data.push(newSpeed);  // Update with current rotational speed

    // If the dataset exceeds a limit (e.g., 100 points), remove the oldest data point
    if (realTimeGraph.data.labels.length > 100) {
        realTimeGraph.data.labels.shift();
        realTimeGraph.data.datasets[0].data.shift();
    }

    // Update the chart with new data
    realTimeGraph.update();
}

// Function to rotate CubeSat image based on incoming data
function rotateCubeSat(rotationAngle) {
    const cubesatImage = document.getElementById('cubesat-2d-image');

    // Apply CSS transform to rotate the CubeSat image
    cubesatImage.style.transform = `rotate(${rotationAngle}deg)`;
}

