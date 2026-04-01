#!/usr/bin/env python3
"""
Interactive HSV tuner for silk masking.

Usage:
  python utils/hsv_tuner.py data/raw_videos/test.mov

Controls:
  - Adjust sliders to set lower/upper HSV values
  - Frame index box: set which frame to preview (enter number + Enter)
  - Press 's' to save current HSV to config/hsv_settings.json
  - Press 'q' or ESC to quit
"""
import cv2
import numpy as np
import json
import sys

# This script provides an interactive OpenCV window to tune HSV color thresholds for silk masking.
# It loads a video, allows frame selection, and lets you adjust HSV sliders to find the best mask.
# Settings can be saved to config/hsv_settings.json for use in other scripts.
from pathlib import Path

if len(sys.argv) < 2:
    print("Usage: python utils/hsv_tuner.py path/to/video.mov")
    sys.exit(1)

VIDEO_PATH = Path(sys.argv[1])
OUT_JSON = Path("config/hsv_settings.json")
     # Check for video path argument

cap = cv2.VideoCapture(str(VIDEO_PATH))
if not cap.isOpened():
    print("Cannot open video:", VIDEO_PATH)
    sys.exit(1)
frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
print("Frames in video:", frame_count)

     # Exit if video cannot be opened
# defaults (good starting point for your silk)
init_lower = [8, 150, 150]   # H, S, V
init_upper = [18, 255, 255]

# window & trackbars
win = "HSV Tuner"
cv2.namedWindow(win, cv2.WINDOW_NORMAL)

def nothing(x):
    pass

# create trackbars for lower and upper HSV
cv2.createTrackbar("H lower", win, init_lower[0], 179, nothing)
cv2.createTrackbar("S lower", win, init_lower[1], 255, nothing)
cv2.createTrackbar("V lower", win, init_lower[2], 255, nothing)
cv2.createTrackbar("H upper", win, init_upper[0], 179, nothing)
cv2.createTrackbar("S upper", win, init_upper[1], 255, nothing)
cv2.createTrackbar("V upper", win, init_upper[2], 255, nothing)

# frame index input control
cv2.createTrackbar("frame idx", win, 0, max(0, frame_count-1), nothing)

def draw_overlay(frame, mask):
    # Draws a semi-transparent overlay on the frame to highlight the mask area.
    # frame: input BGR image
    # mask: binary mask (same size as frame)
    # Returns: overlayed image
    dark = (frame * 0.35).astype(np.uint8)
    # bright green for silk area
    highlight = frame.copy()
    highlight[mask > 0] = (0, 255, 0)
    combined = dark.copy()
    combined[mask > 0] = highlight[mask > 0]
    # draw blue contour
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    cv2.drawContours(combined, contours, -1, (255, 0, 0), 3)
    return combined

# main loop
while True:
    # read slider values
    hl = cv2.getTrackbarPos("H lower", win)
    sl = cv2.getTrackbarPos("S lower", win)
    vl = cv2.getTrackbarPos("V lower", win)
    hu = cv2.getTrackbarPos("H upper", win)
    su = cv2.getTrackbarPos("S upper", win)
    vu = cv2.getTrackbarPos("V upper", win)
    fidx = cv2.getTrackbarPos("frame idx", win)

    # read frame fidx
    cap.set(cv2.CAP_PROP_POS_FRAMES, fidx)
    ok, frame = cap.read()
    if not ok:
        # blank frame if failed
        frame = np.zeros((480,640,3), dtype=np.uint8)
        cv2.putText(frame, "Cannot read frame", (10,30), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0,0,255), 2)

    # compute mask
    lower = np.array([hl, sl, vl], dtype=np.uint8)
    upper = np.array([hu, su, vu], dtype=np.uint8)
    hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
    mask = cv2.inRange(hsv, lower, upper)
    # morphological cleanup tuned to be conservative by default
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, np.ones((7,7),np.uint8))
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, np.ones((5,5),np.uint8))

    # overlay
    out_img = draw_overlay(frame, mask)

    # show text info and current HSV
    info = f"Hlow:{hl} Slow:{sl} Vlow:{vl}  |  Hup:{hu} Sup:{su} Vup:{vu}  Frame:{fidx}"
    cv2.putText(out_img, info, (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255,255,255), 2, cv2.LINE_AA)
    cv2.imshow(win, out_img)

    key = cv2.waitKey(50) & 0xFF
    if key == ord('q') or key == 27:  # q or ESC
        break
    if key == ord('s'):
        # save current HSV settings to JSON
        settings = {
            "lower": [int(hl), int(sl), int(vl)],
            "upper": [int(hu), int(su), int(vu)]
        }
        OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
        with open(OUT_JSON, "w") as f:
            json.dump(settings, f, indent=2)
        print("Saved HSV settings to", OUT_JSON)
        # also write quick preview overlay image
        cv2.imwrite("hsv_preview_overlay.jpg", out_img)
        print("Saved preview image hsv_preview_overlay.jpg")

cap.release()
cv2.destroyAllWindows()
