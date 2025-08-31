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
print("Please provide all dimensions in inches. Use a ruler to measure your label sheet.")
cols = get_user_input("Enter number of columns (labels left-to-right): ", int)
rows = get_user_input("Enter number of rows (labels top-to-bottom): ", int)
label_width = get_user_input("Enter the width of a single label: ")
label_height = get_user_input("Enter the height of a single label: ")
margin_top = get_user_input("Enter the top page margin: ")
margin_left = get_user_input("Enter the left page margin: ")
horizontal_gap = get_user_input("Enter the horizontal gap (space between labels side-by-side): ")
vertical_gap = get_user_input("Enter the vertical gap (space between labels top-to-bottom): ")
print("------------------------------------")

# --- Static Configuration ---
CSV_FILE_PATH = 'students.csv'
QR_CODES_FOLDER = 'qr_codes'
OUTPUT_HTML_FILE = 'labels.html'
LABELS_PER_PAGE = cols * rows

# --- Generate the HTML and CSS dynamically ---
html_content = f"""
<!DOCTYPE html>
<html>
<head>
<title>Printable QR Code Labels</title>
<style>
    /* This rule is for the browser's print engine */
    @page {{
        size: 8.5in 11in;
        margin: 0; /* Force the browser to have NO default margins */
    }}
    body {{
        margin: 0;
        padding: 0;
        font-family: Arial, sans-serif;
    }}
    /* --- NEW: A container for a single sheet of paper --- */
    .printable-page {{
        width: 8.5in;
        height: 11in;
        position: relative; /* This is key for positioning the grid */
        page-break-after: always; /* Each one is a new page */
        overflow: hidden;
    }}
    /* --- NEW: The label grid is now positioned INSIDE the paper container --- */
    .label-grid {{
        position: absolute;
        top: {margin_top}in;
        left: {margin_left}in;
        display: grid;
        grid-template-columns: repeat({cols}, {label_width}in);
        grid-template-rows: repeat({rows}, {label_height}in);
        grid-gap: {vertical_gap}in {horizontal_gap}in;
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

label_count = 0

for index, row in df.iterrows():
    if label_count % LABELS_PER_PAGE == 0:
        if label_count > 0:
            html_content += '</div></div>' # Close previous grid and page
        html_content += '<div class="printable-page"><div class="label-grid">' # Start new page and grid
    
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
        html_content += f'<div class="label"><div class="name">Img not found</div></div>'
    label_count += 1

# Fill remaining grid cells to maintain structure
while label_count % LABELS_PER_PAGE != 0:
    html_content += '<div class="label"></div>'
    label_count += 1

html_content += "</div></div></body></html>" # Close final tags

with open(OUTPUT_HTML_FILE, 'w') as f:
    f.write(html_content)

print(f"Success! Created '{OUTPUT_HTML_FILE}'.")