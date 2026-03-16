import { fetchJson } from './http';

// Use relative path so it works with proxy (Dev: Vite Proxy, Prod: Nginx Proxy)
const API_URL = '/api/dashboard';

export async function fetchDashboardData(city, category, seller) {
    try {
        const queryParams = new URLSearchParams();
        if (city && city.length > 0) queryParams.append('city', city);
        if (category && category.length > 0) queryParams.append('category', category);
        if (seller && seller.length > 0) queryParams.append('seller', seller);

        const url = `${API_URL}?${queryParams.toString()}`;
        return await fetchJson(url, { cache: 'no-store' });
    } catch (error) {
        console.error("Failed to fetch dashboard data:", error);
        throw error;
    }
}

export async function fetchProjectData(city, category, seller) {
    try {
        const queryParams = new URLSearchParams();
        if (city && city.length > 0) queryParams.append('city', city);
        if (category && category.length > 0) queryParams.append('category', category);
        if (seller && seller.length > 0) queryParams.append('seller', seller);

        const url = `/api/projects?${queryParams.toString()}`;
        return await fetchJson(url, { cache: 'no-store' });
    } catch (error) {
        console.error("Failed to fetch project data:", error);
        throw error;
    }
}

export async function fetchParadosData(city, seller) {
    try {
        const queryParams = new URLSearchParams();
        if (city && city.length > 0) queryParams.append('city', city);
        if (seller && seller.length > 0) queryParams.append('seller', seller);

        const url = `/api/parados?${queryParams.toString()}`;
        return await fetchJson(url, { cache: 'no-store' });
    } catch (error) {
        console.error("Failed to fetch parados data:", error);
        throw error;
    }
}

export async function fetchDocConferenceData(city, category, seller, confStatus, dateFrom, dateTo, scope, search) {
    try {
        const queryParams = new URLSearchParams();
        if (city && city.length > 0) queryParams.append('city', city);
        if (category && category.length > 0) queryParams.append('category', category);
        if (seller && seller.length > 0) queryParams.append('seller', seller);
        if (confStatus && confStatus.length > 0) queryParams.append('conf_status', confStatus);
        if (dateFrom) queryParams.append('date_from', dateFrom);
        if (dateTo) queryParams.append('date_to', dateTo);
        if (scope) queryParams.append('scope', scope);
        if (search) queryParams.append('search', search);

        const url = `/api/doc-conference?${queryParams.toString()}`;
        return await fetchJson(url, { cache: 'no-store' });
    } catch (error) {
        console.error("Failed to fetch document conference data:", error);
        throw error;
    }
}

export async function fetchDocConferenceSellerAvg(city, category, seller, confStatus, dateFrom, dateTo, scope, search) {
    try {
        const queryParams = new URLSearchParams();
        if (city && city.length > 0) queryParams.append('city', city);
        if (category && category.length > 0) queryParams.append('category', category);
        if (seller && seller.length > 0) queryParams.append('seller', seller);
        if (confStatus && confStatus.length > 0) queryParams.append('conf_status', confStatus);
        if (dateFrom) queryParams.append('date_from', dateFrom);
        if (dateTo) queryParams.append('date_to', dateTo);
        if (scope) queryParams.append('scope', scope);
        if (search) queryParams.append('search', search);

        const url = `/api/doc-conference/seller-avg?${queryParams.toString()}`;
        return await fetchJson(url, { cache: 'no-store' });
    } catch (error) {
        console.error("Failed to fetch document conference seller averages:", error);
        throw error;
    }
}

export async function fetchPlatesData() {
    try {
        return await fetchJson('/api/plates', { cache: 'no-store' });
    } catch (error) {
        console.error("Failed to fetch plates data:", error);
        throw error;
    }
}

// Keep constants for shapes if component relies on them initially, but mostly replaced by API
export const KPI_DATA_SHAPE = {
    generateOS: { title: "GERAR O.S.", count: 0, color: "#FFA500", statusId: "generate_os" },
    priorities: { title: "PRIORIDADES PARA ENTREGA", count: 0, color: "#FFA500", statusId: "priority" },
    toDeliver: { title: "OBRAS A ENTREGAR", count: 0, color: "#FFA500", statusId: "to_deliver" },
    delivered: { title: "OBRAS ENTREGUES", count: 0, color: "#FFA500", statusId: "delivered" },
    inExecution: { title: "OBRAS EM EXECUÇÃO", count: 0, color: "#FFA500", statusId: "in_execution" }
};
