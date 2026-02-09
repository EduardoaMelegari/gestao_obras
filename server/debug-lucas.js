import axios from 'axios';

// URL from sync-sheets.js (LUCAS DO RIO VERDE)
const url = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTPVWujNnTvpv-CDJ2FPYxytXxw0CiPDnmt_M5oxM6kBqQb6z25VvhbVHhsF78dI91RQAqSIVr9b8d8/pub?gid=190340504&single=true&output=csv';

async function fetchHeaders() {
    try {
        console.log(`Fetching Lucas do Rio Verde CSV...`);
        const response = await axios.get(url);
        const csvData = response.data;
        const lines = csvData.split('\n'); // Split by newline

        if (lines.length > 0) {
            const headers = lines[0].split(',').map(h => h.trim());
            console.log("\n--- HEADERS FOUND ---");
            headers.forEach((h, i) => console.log(`${i}: ${h}`));

            console.log("\n--- SEARCHING FOR 'ID' COLUMNS ---");
            headers.forEach((h, i) => {
                const upper = h.toUpperCase();
                if (upper.includes('ID') || upper.includes('ORDEM') || upper.includes('OS')) {
                    console.log(`[MATCH] Index ${i}: '${h}'`);
                    // Print char codes to check for hidden chars
                    const codes = [];
                    for (let j = 0; j < h.length; j++) {
                        codes.push(h.charCodeAt(j));
                    }
                    console.log(`   Char Codes: ${codes.join(' ')}`);
                }
            });

            if (lines.length > 1) {
                console.log("\n--- FIRST ROW DATA ---");
                // Print a few columns that might be ID
                const firstRow = lines[1].split(',');
                // Just printing the whole first row logic for valid ID candidates
                headers.forEach((h, i) => {
                    if (h.toUpperCase().includes('ID') || h.toUpperCase().includes('ORDEM') || h.toUpperCase().includes('OS')) {
                        console.log(`${h}: ${firstRow[i]}`);
                    }
                });
            }

        } else {
            console.log("CSV is empty.");
        }
    } catch (error) {
        console.error("Error fetching CSV:", error.message);
    }
}

fetchHeaders();
