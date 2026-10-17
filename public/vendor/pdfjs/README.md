pdf.js 3.11.174 (Mozilla, Apache-2.0 — see LICENSE), the legacy build so older
phones' browsers can run it. Copied unchanged from the npm package pdfjs-dist@3.11.174
(legacy/build/pdf.min.js and pdf.worker.min.js).

Used only by the Finances office's finance tool, to read the text of the monthly
report PDFs (teams/09-finance.js loads it the first time a PDF is picked). It is
not precached by the service worker and nothing else on the site loads it.
