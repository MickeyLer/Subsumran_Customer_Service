/**
 * Recursively sanitizes an object or array for Firestore.
 * Converts `undefined` values to `null`.
 * 
 * @param {any} data - The data to sanitize.
 * @returns {any} - The sanitized data.
 */
export const sanitizeForFirestore = (data) => {
    if (data === undefined) {
        return null;
    }

    if (data === null || typeof data !== 'object') {
        return data;
    }

    // Handle Date objects and Firestore Timestamps (pass through)
    if (data instanceof Date || (data.toDate && typeof data.toDate === 'function') || (data.toMillis && typeof data.toMillis === 'function')) {
        return data;
    }

    // Pass through objects that are likely Firestore Sentinels (serverTimestamp, etc.) or specialized classes
    // They usually have a constructor that is NOT 'Object' or 'Array'
    if (data.constructor && data.constructor.name !== 'Object' && data.constructor.name !== 'Array') {
        return data;
    }

    if (Array.isArray(data)) {
        return data.map(item => sanitizeForFirestore(item));
    }

    const sanitizedObject = {};
    for (const key in data) {
        if (Object.prototype.hasOwnProperty.call(data, key)) {
            sanitizedObject[key] = sanitizeForFirestore(data[key]);
        }
    }

    return sanitizedObject;
};

/**
 * Safely formats a Firestore Timestamp or Date object.
 * Returns empty string if invalid.
 */
export const formatFirestoreTimestamp = (timestamp, locale = 'th-TH') => {
    if (!timestamp) return '';

    try {
        if (timestamp.toDate && typeof timestamp.toDate === 'function') {
            return timestamp.toDate().toLocaleString(locale);
        }
        if (timestamp instanceof Date) {
            return timestamp.toLocaleString(locale);
        }
        // Handle case where it might be a plain object with seconds (corrupted timestamp)
        if (timestamp.seconds) {
            return new Date(timestamp.seconds * 1000).toLocaleString(locale);
        }
    } catch (error) {
        console.error('Error formatting timestamp:', error);
        return '';
    }
    return '';
};
