import axios from 'axios';

async function checkApi() {
    try {
        console.log("Fetching API...");
        const response = await axios.get('http://localhost:36006/api/dashboard');
        const data = response.data;

        if (data.vistoria) {
            console.log("Vistoria Data Found.");

            const pools = ['solicitar', 'solicitadas', 'atrasadas'];
            let foundRecord = false;

            pools.forEach(pool => {
                if (data.vistoria[pool] && data.vistoria[pool].length > 0) {
                    console.log(`\n--- Pool: ${pool} ---`);
                    const item = data.vistoria[pool][0];
                    console.log("Client:", item.client);
                    console.log("Seller:", item.seller);
                    console.log("Folder:", item.folder);
                    console.log("External ID:", item.external_id);
                    console.log("Team:", item.team);
                    console.log("Project Status:", item.project_status);
                    console.log("Vistoria Status:", item.vistoria_status);

                    if (item.seller) foundRecord = true;
                } else {
                    console.log(`\n--- Pool: ${pool} is EMPTY ---`);
                }
            });

            if (!foundRecord) {
                console.log("\nWARNING: No 'seller' data found in any Vistoria pools.");
            } else {
                console.log("\nSUCCESS: At least one record has 'seller' data.");
            }

        } else {
            console.error("No 'vistoria' key in response.");
        }

    } catch (error) {
        console.error("API Error:", error.message);
    }
}

checkApi();
