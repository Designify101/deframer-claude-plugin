---
description: Bring a Deframer project you downloaded from deframer.co into this folder
argument-hint: "[zip-path] [folder]"
---

Bring a project the user unlocked and downloaded on deframer.co into the working directory.

1. Find the zip: $0 if given, otherwise the newest `*.zip` from Deframer in the user's Downloads
   folder. Confirm the file with the user before using it.
2. Unzip it into a new folder ($1 if given, else a folder named after the zip), never over existing
   files.
3. Tell the user to run `npm install` and `npm run dev` there (for a Static HTML export, open
   `index.html` or upload the folder to any static host).

If the project isn't downloaded yet, ask for the job page link and send the user there to unlock it.
