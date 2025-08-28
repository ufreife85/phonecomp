# generate_labels.py
import pandas as pd
import os

# --- Function to get user input with validation ---
def get_user_input(prompt, input_type=float):
    while True:
        try:
            value = input(prompt)
            return input_type(value)
        except ValueError:
            print(f"Invalid input. Please enter a valid {input_type.__name__}.")

# --- Get layout details from the user ---
print("--- Label Layout Configuration ---")
print("Please provide the dimensions in inches.")
cols = get_user_input("Enter number of columns (labels left-to-right): ", int)
rows = get_user_input("Enter number of rows (labels top-to-bottom): ", int)
label_width = get_user_input("Enter the width of a single label: ")
label_height = get_user_input("Enter the height of a single label: ")
margin_top = get_user_input("Enter the top page margin: ")
margin_left = get_user_input("Enter the left page margin: ")
print("------------------------------------")

# --- Static Configuration ---
CSV_FILE_PATH = 'students.csv'
QR_CODES_FOLDER = 'qr_codes'
OUTPUT_HTML_FILE = 'labels.html'
LABELS_PER_PAGE = cols * rows

# --- Generate the HTML and CSS dynamically based on user input ---
html_content = f"""
<!DOCTYPE html>
<html>
<head>
<title>Printable QR Code Labels</title>
<style>
    body {{
        width: 8.5in;
        height: 11in;
        margin: 0;
        padding: 0;
        font-family: Arial, sans-serif;
    }}
    .page {{
        width: {cols * label_width}in;
        height: {rows * label_height}in;
        margin: {margin_top}in {margin_left}in;
        display: grid;
        grid-template-columns: repeat({cols}, 1fr);
        grid-template-rows: repeat({rows}, 1fr);
        gap: 0;
        page-break-after: always; /* Ensure each grid is on a new page */
    }}
    .label {{
        width: {label_width}in;
        height: {label_height}in;
        padding: 0.05in;
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        text-align: center;
        overflow: hidden;
    }}
    .label img {{
        height: {min(label_width, label_height) * 0.65}in;
        width: {min(label_width, label_height) * 0.65}in;
        display: block;
    }}
    .label .name {{
        font-size: 6pt;
        font-weight: bold;
        margin-top: 0.05in;
        line-height: 1.1;
        max-height: 0.2in;
    }}
    @media print {{
        body {{ margin: 0; }}
        .page {{
            margin: {margin_top}in {margin_left}in;
        }}
    }}
</style>
</head>
<body>
"""

try:
    df = pd.read_csv(CSV_FILE_PATH)
except FileNotFoundError:
    print(f"Error: The file '{CSV_FILE_PATH}' was not found.")
    exit()

if 'qrId' not in df.columns or 'fullName' not in df.columns:
    print("Error: CSV must contain 'qrId' and 'fullName' columns.")
    exit()

print(f"Generating labels for {len(df)} students...")

page_count = 0
label_count = 0

for index, row in df.iterrows():
    if label_count % LABELS_PER_PAGE == 0:
        if page_count > 0:
            html_content += '</div>'
        html_content += '<div class="page">'
        page_count += 1

    qr_id = str(row['qrId'])
    full_name = str(row['fullName'])
    qr_image_path = os.path.join(QR_CODES_FOLDER, f"{qr_id}.png")

    if os.path.exists(qr_image_path):
        html_content += f"""
        <div class="label">
            <img src="{qr_image_path}" alt="QR Code for {qr_id}">
            <div class="name">{full_name}</div>
        </div>
        """
    else:
        html_content += f"""
        <div class="label">
            <div class="name">Img not found: {full_name}</div>
        </div>
        """
    label_count += 1

while label_count % LABELS_PER_PAGE != 0:
    html_content += '<div class="label"></div>'
    label_count += 1

html_content += "</div></body></html>"

with open(OUTPUT_HTML_FILE, 'w') as f:
    f.write(html_content)

print(f"Success! Created '{OUTPUT_HTML_FILE}'. Open this file in a browser to print.")