# create_qrcodes.py
import pandas as pd
import qrcode
import os

# --- Configuration ---
CSV_FILE_PATH = 'students.csv'
OUTPUT_FOLDER = 'qr_codes'
# -------------------

# Create the output folder if it doesn't exist
if not os.path.exists(OUTPUT_FOLDER):
    os.makedirs(OUTPUT_FOLDER)

# Read the student data from the CSV file
try:
    df = pd.read_csv(CSV_FILE_PATH)
except FileNotFoundError:
    print(f"Error: The file '{CSV_FILE_PATH}' was not found in this directory.")
    exit()

# Check if the required 'qrId' column exists
if 'qrId' not in df.columns:
    print("Error: Your CSV file must contain a column named 'qrId'.")
    exit()

print(f"Found {len(df)} students. Generating QR codes...")

# Loop through each student in the spreadsheet
for index, row in df.iterrows():
    qr_id = str(row['qrId'])
    
    # Create the QR code object
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_L,
        box_size=10,
        border=4,
    )
    
    # Add the data (the unique qrId) to the QR code
    qr.add_data(qr_id)
    qr.make(fit=True)

    # Create an image from the QR Code instance
    img = qr.make_image(fill_color="black", back_color="white")

    # Save the image to the output folder
    file_path = os.path.join(OUTPUT_FOLDER, f"{qr_id}.png")
    img.save(file_path)

print(f"Success! Created {len(df)} QR codes in the '{OUTPUT_FOLDER}' folder.")