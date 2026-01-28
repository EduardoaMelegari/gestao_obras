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
        type: DataTypes.STRING,
    },
    // Vistoria Fields
    vistoria_status: {
        type: DataTypes.STRING,
        allowNull: true
    },
    vistoria_date: {
        type: DataTypes.STRING,
        allowNull: true
    },
    vistoria_deadline: {
        type: DataTypes.STRING,
        allowNull: true
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
