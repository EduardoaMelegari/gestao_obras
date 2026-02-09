import axios from 'axios';

// URL from sync-sheets.js (Sorriso)
const url = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQHlUaE1_7XtdwIBnBdpQslgLfuUF4nYkcb5naBD-r6wO1fvF71H7MSFS7aAgo23ZcWDV6NWNv60tXo/pub?gid=1627447881&single=true&output=csv';

async function fetchHeaders() {
    try {
        console.log(`Fetching ${url}...`);
        const response = await axios.get(url);
        const csvData = response.data;
        const lines = csvData.split('\n'); // Split by newline

        if (lines.length > 0) {
            const headers = lines[0].split(',').map(h => h.trim());
            console.log("--- HEADERS FOUND ---");
            headers.forEach((h, i) => console.log(`${i}: ${h}`));

            console.log("\n--- TRYING TO FIND TARGET COLUMNS ---");
            console.log("Looking for 'VENDEDOR' or 'CONSULTOR'...");
            const vendedorIdx = headers.findIndex(h => h.toUpperCase() === 'VENDEDOR' || h.toUpperCase() === 'CONSULTOR');
            console.log(`VENDEDOR Index: ${vendedorIdx}`);

            console.log("Looking for 'PASTA'...");
            const pastaIdx = headers.findIndex(h => h.toUpperCase() === 'PASTA');
            console.log(`PASTA Index: ${pastaIdx}`);

            if (lines.length > 1) {
                console.log("\n--- FIRST ROW DATA ---");
                const firstRow = lines[1].split(',');
                console.log(`VENDEDOR Value: ${firstRow[vendedorIdx]}`);
                console.log(`PASTA Value: ${firstRow[pastaIdx]}`);
            }

        } else {
            console.log("CSV is empty.");
        }
    } catch (error) {
        console.error("Error fetching CSV:", error.message);
        if (error.response) {
            console.error("Status:", error.response.status);
            console.error("Data:", error.response.data);
        }
    }
}

fetchHeaders();
