import { sequelize } from './db.js';
import Project from './models/Project.js';

async function checkDB() {
    try {
        console.log("Connecting to DB...");
        await sequelize.authenticate();
        console.log("Connected.");

        // Sync to ensure schema is updated (in case main server didn't)
        // verify if columns exist by selecting one record
        const project = await Project.findOne();

        if (project) {
            console.log("\n--- RECORD FOUND ---");
            console.log("ID:", project.id);
            console.log("Client:", project.client);
            console.log("Seller (Vendedor):", project.seller);
            console.log("Folder (Pasta):", project.folder);

            if (project.seller === undefined) {
                console.error("ERROR: 'seller' field is undefined in the model result. Schema might not be updated.");
            } else if (project.seller === null) {
                console.warn("WARNING: 'seller' is null. Data sync might not have captured it.");
            } else {
                console.log("SUCCESS: 'seller' field exists and has data.");
            }
        } else {
            console.log("No projects found in DB.");
        }

    } catch (error) {
        console.error("DB Error:", error);
    } finally {
        await sequelize.close();
    }
}

checkDB();
