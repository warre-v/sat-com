from flask import Flask, request, jsonify
from flask_cors import CORS
from PIL import Image
import numpy as np
import os

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

BASE_DIR = os.path.dirname(__file__)
OUTPUT_DIR = os.path.join(BASE_DIR, 'bin_images')
IMAGE_DIR = os.path.join(BASE_DIR, 'images')
OUTPUT_FILE = os.path.join(OUTPUT_DIR, 'output.bin')
IMAGE_FILE = os.path.join(IMAGE_DIR, 'reconstructed_image.jpg')
RECEIVED_IMAGE_FILE = os.path.join(BASE_DIR, 'received_image.bin')

# Ensure the directories exist
os.makedirs(OUTPUT_DIR, exist_ok=True)
os.makedirs(IMAGE_DIR, exist_ok=True)

@app.route('/process_data', methods=['POST'])
def process_data():
    try:
        data = request.data
        print(f"Received {len(data)} bytes of data")
        with open(OUTPUT_FILE, 'wb') as f:
            f.write(data)
        print(f"Data written to {OUTPUT_FILE}")

        # Process the binary data to create an image
        bin_to_img()
        return jsonify({"status": "success", "message": "Data processed successfully"})
    except Exception as e:
        print(f"Error processing data: {e}")
        return jsonify({"status": "error", "message": str(e)})

@app.route('/upload', methods=['POST'])
def upload_image():
    try:
        image_data = request.data
        if not image_data:
            return {"error": "No image data provided"}, 400

        # Write the binary data to a file
        with open(RECEIVED_IMAGE_FILE, 'wb') as bin_file:
            bin_file.write(image_data)

        # Convert binary data to image
        try:
            # Convert the binary data to a numpy array
            img_array = np.frombuffer(image_data, dtype=np.uint8)
            
            # The image should be 96x54 pixels (5184 bytes total)
            if len(img_array) != 5184:  # 96 * 54
                return {"error": f"Invalid data length: {len(img_array)}"}, 400
            
            # Reshape the array to image dimensions
            img_array = img_array.reshape((54, 96))
            
            # Create and save the image
            img = Image.fromarray(img_array, mode='L')
            img.save(IMAGE_FILE)
            
            return {"message": "Image saved and converted successfully"}, 200
        except Exception as e:
            return {"error": f"Failed to convert image: {str(e)}"}, 500

    except Exception as e:
        return {"error": str(e)}, 500

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
    app.run(debug=True, host='0.0.0.0', port=5000)