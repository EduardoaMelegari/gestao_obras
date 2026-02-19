import { DataTypes } from 'sequelize';
import { sequelize } from '../db.js';

const AccessLog = sequelize.define('AccessLog', {
    sessionId: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    ip: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    city: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    region: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    country: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    lat: {
        type: DataTypes.FLOAT,
        allowNull: true,
    },
    lon: {
        type: DataTypes.FLOAT,
        allowNull: true,
    },
    userAgent: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
    // Parsed browser name stored at insert time
    browser: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    accessedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
    },
}, {
    tableName: 'access_logs',
    timestamps: false,
});

export default AccessLog;
