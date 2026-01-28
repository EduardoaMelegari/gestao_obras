const API_URL = 'http://localhost:36006/api/dashboard';

export async function fetchDashboardData(city) {
    try {
        const url = city ? `${API_URL}?city=${encodeURIComponent(city)}` : API_URL;
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        return await response.json();
    } catch (error) {
        console.error("Failed to fetch dashboard data:", error);
        // Fallback or re-throw
        return null;
    }
}

// Keep constants for shapes if component relies on them initially, but mostly replaced by API
export const KPI_DATA_SHAPE = {
    priorities: { title: "PRIORIDADES PARA ENTREGA", count: 0, color: "#FFA500", statusId: "priority" },
    toDeliver: { title: "OBRAS A ENTREGAR", count: 0, color: "#FFA500", statusId: "to_deliver" },
    delivered: { title: "OBRAS ENTREGUES", count: 0, color: "#FFA500", statusId: "delivered" },
    inExecution: { title: "OBRAS EM EXECUÇÃO", count: 0, color: "#FFA500", statusId: "in_execution" }
};
