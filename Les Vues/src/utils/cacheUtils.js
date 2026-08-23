const CACHE_TTL = 12 * 60 * 60 * 1000;

export const filterUnique = (prevList = [], newList = []) => {
    const existingIds = new Set(prevList.map(item => item.id));
    return [...prevList, ...newList.filter(item => !existingIds.has(item.id))];
};


export const cleanExpiredCache = () => {
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        const raw = localStorage.getItem(key);
        try {
            const entry = JSON.parse(raw);
            if (entry.timestamp && Date.now() - entry.timestamp > CACHE_TTL) {
                localStorage.removeItem(key);
            }
        } catch (e) { }
    }
};


export const getCachedData = (key) => {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    try {
        const entry = JSON.parse(raw);
        if (Date.now() - entry.timestamp > CACHE_TTL) {
            localStorage.removeItem(key);
            return null;
        }
        return entry;
    } catch (e) {
        return null;
    }
};


export const setCachedData = (key, data, page=0) => {
    const entry = { data, page, timestamp: Date.now() };
    localStorage.setItem(key, JSON.stringify(entry));
};


export const updateCachedData = (key, newData, page=0) => {
    const existing = getCachedData(key);
    if (!existing) {
        setCachedData(key, newData, page);
        return;
    }
    const mergedData = filterUnique(existing.data, newData);
    setCachedData(key, mergedData, page);
};