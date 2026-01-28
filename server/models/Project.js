import { DataTypes } from 'sequelize';
import { sequelize } from '../db.js';

const Project = sequelize.define('Project', {
    client: {
        type: DataTypes.STRING,
        allowNull: false
    },
    status: {
        type: DataTypes.ENUM('GENERATE_OS', 'PRIORITY', 'TO_DELIVER', 'DELIVERED', 'IN_EXECUTION'),
        allowNull: false
    },
    days: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    team: {
        type: DataTypes.STRING,
        defaultValue: ''
    },
    external_id: {
        type: DataTypes.STRING, /* ID from Sheet if available, or generated */
    },
    city: {
        type: DataTypes.STRING,
        defaultValue: 'SORRISO'
    },
    details: {
        type: DataTypes.STRING
    }
});

export default Project;
