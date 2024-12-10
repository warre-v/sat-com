from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from PIL import Image
import numpy as np
import os
import binascii

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

BASE_DIR = os.path.dirname(__file__)
OUTPUT_DIR = os.path.join(BASE_DIR, 'output')
IMAGE_DIR = os.path.join(BASE_DIR, 'images')
BIN_FILE = os.path.join(OUTPUT_DIR, 'received_image.bin')
TXT_FILE = os.path.join(OUTPUT_DIR, 'received_image.txt')
IMAGE_FILE = os.path.join(IMAGE_DIR, 'reconstructed_image.jpg')

# Ensure the directories exist
os.makedirs(OUTPUT_DIR, exist_ok=True)
os.makedirs(IMAGE_DIR, exist_ok=True)

@app.route('/upload', methods=['POST'])
def upload_image():
    try:
        # Get hex data from request
        hex_data = request.data.decode('utf-8')
        
        # Save the hex data as a .txt file
        with open(TXT_FILE, 'w') as f:
            f.write(hex_data)
        
        # Convert hex data to binary data
        binary_data = binascii.unhexlify(hex_data)
        
        # Save the binary data as a .bin file
        with open(BIN_FILE, 'wb') as f:
            f.write(binary_data)
        
        # Convert binary data to image
        bin_to_img(BIN_FILE, IMAGE_FILE)
        
        # Notify the front-end to refresh the image
        return jsonify({"status": "success"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/get-image', methods=['GET'])
def get_image():
    try:
        image_path = os.path.join(IMAGE_DIR, 'reconstructed_image.jpg')
        if os.path.exists(image_path):
            return send_file(image_path, mimetype='image/jpeg')
        else:
            return jsonify({"error": "No image available"}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500

def bin_to_img(bin_file_path, output_image_path):
    try:
        # Read binary data from file
        with open(bin_file_path, 'rb') as bin_file:
            binary_data = bin_file.read()

        # Convert binary data to NumPy array
        binarr = np.frombuffer(binary_data, dtype=np.uint8)

        # Dimensions of the original image (update to match your original image dimensions)
        image_width = 96  # Example width
        image_height = 54  # Example height

        # Validate data length matches image dimensions
        expected_size = image_width * image_height
        if len(binarr) != expected_size:
            print(f"Binary data size {len(binarr)} does not match expected image size {expected_size}. Adding green line.")
            # Add green line (value 0 for grayscale) to fill the remaining space
            binarr = np.pad(binarr, (0, expected_size - len(binarr)), 'constant', constant_values=0)

        # Reshape the array to match the original image dimensions
        img = binarr.reshape((image_height, image_width))

        # Convert the NumPy array back to an image in grayscale mode
        reconstructed_image = Image.fromarray(img, mode='L')

        # Save the reconstructed image
        reconstructed_image.save(output_image_path)
        print(f"Reconstructed image saved to {output_image_path}")

    except Exception as e:
        print(f"Error converting binary data to image: {e}")
        raise

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)