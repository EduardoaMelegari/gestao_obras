import { DataTypes } from 'sequelize';
import { sequelize } from '../db.js';

const Project = sequelize.define('Project', {
    client: {
        type: DataTypes.STRING,
        allowNull: false
    },
    status: {
        type: DataTypes.ENUM('GENERATE_OS', 'PRIORITY', 'TO_DELIVER', 'DELIVERED', 'IN_EXECUTION', 'COMPLETED', 'PROJECT'),
        allowNull: false
    },
    project_status: {
        type: DataTypes.STRING,
        allowNull: true
    },
    category: {
        type: DataTypes.STRING,
        allowNull: true
    },
    days: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    team: {
        type: DataTypes.STRING,
        defaultValue: ''
    },
    // New Fields for Vistoria Table
    seller: {
        type: DataTypes.STRING,
        allowNull: true
    },
    folder: {
        type: DataTypes.STRING,
        allowNull: true
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
    // New Fields from Projects Tab
    install_date: {
        type: DataTypes.STRING,
        allowNull: true
    },
    has_inverter: {
        type: DataTypes.STRING,
        allowNull: true
    },
    deadline: {
        type: DataTypes.STRING,
        allowNull: true
    },
    vistoria_opinion: {
        type: DataTypes.STRING,
        allowNull: true
    },
    meter_status: {
        type: DataTypes.STRING,
        allowNull: true
    },
    app_status: {
        type: DataTypes.STRING,
        allowNull: true
    },
    vistoria_2nd_date: {
        type: DataTypes.STRING,
        allowNull: true
    },
    // Calculated Field
    days_since_doc_conf: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    doc_conf_date: {
        type: DataTypes.STRING,
        allowNull: true
    },
    details: {
        type: DataTypes.STRING
    }
});

export default Project;
