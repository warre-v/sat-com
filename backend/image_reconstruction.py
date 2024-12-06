import serial
from PIL import Image
import numpy as np
import os

# Serial port configuration
SERIAL_PORT = 'COM3'  # Replace with your Arduino's port (e.g., /dev/ttyUSB0 on Linux/Mac)
BAUD_RATE = 9600
BASE_DIR = os.path.dirname(__file__)
OUTPUT_FILE = os.path.join(BASE_DIR, 'bin_images', 'output.bin')
HEX_OUTPUT_FILE = os.path.join(BASE_DIR, 'hex_output.txt')

def recv_data():
    # Open the serial port
    ser = serial.Serial(SERIAL_PORT, BAUD_RATE, timeout=1)
    print(f"Listening on {SERIAL_PORT} at {BAUD_RATE} baud")
    
    # Open files to save the binary data and hexadecimal data
    with open(HEX_OUTPUT_FILE, 'w') as hex_file, open(OUTPUT_FILE, 'wb') as bin_file:
        try:
            while True:
                # Read data from the serial port
                data = ser.read(1024)  # Read up to 1024 bytes
                if data:
                    print(f"Received {len(data)} bytes: {data}")
                    hex_data = data.hex()
                    hex_file.write(hex_data + '\n')
                    hex_file.flush()
                    bin_file.write(data)
                    bin_file.flush()
        except KeyboardInterrupt:
            print("Terminating...")
        finally:
            ser.close()
            print(f"Hexadecimal data saved to {HEX_OUTPUT_FILE}")

def hex_to_binary(input_file, output_file):
    try:
        with open(input_file, 'r') as hex_file, open(output_file, 'wb') as binary_file:
            for line in hex_file:
                # Strip whitespace and newline characters
                hex_data = line.strip()
                
                # Convert the hex string to bytes and write to the binary file
                binary_file.write(bytes.fromhex(hex_data))
        print(f"Binary file '{output_file}' successfully created from '{input_file}'.")
    except FileNotFoundError:
        print(f"Error: Input file '{input_file}' not found.")
    except ValueError as e:
        print(f"Error: Invalid hex data in the file. {e}")
    except Exception as e:
        print(f"Unexpected error: {e}")

def bin_to_img():
    # Path to the binary file
    binary_file_path = OUTPUT_FILE
    # Path to save the reconstructed image
    output_image_path = IMAGE_FILE

    # Dimensions of the original image (update to match your original image dimensions)
    image_width = 96  # Example width
    image_height = 54  # Example height

    # Read the binary file
    with open(binary_file_path, 'rb') as bin_file:
        binary_data = bin_file.read()

    print(f"Binary data length: {len(binary_data)}")

    # Convert binary data to NumPy array
    binarr = np.frombuffer(binary_data, dtype=np.uint8)

    # Validate data length matches image dimensions
    expected_size = image_width * image_height
    if len(binarr) != expected_size:
        raise ValueError(f"Binary data size {len(binarr)} does not match expected image size {expected_size}.")

    # Reshape the array to match the original image dimensions
    img = binarr.reshape((image_height, image_width))

    # Convert the NumPy array back to an image in grayscale mode
    reconstructed_image = Image.fromarray(img, mode='L')

    # Save the reconstructed image
    reconstructed_image.save(output_image_path)
    print(f"Reconstructed image saved to {output_image_path}")

if __name__ == '__main__':
    recv_data()
    hex_to_binary(HEX_OUTPUT_FILE, OUTPUT_FILE)
    bin_to_img()
