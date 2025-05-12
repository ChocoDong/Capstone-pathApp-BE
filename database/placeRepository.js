const db = require('./db_connect');

/**
 * 장소 정보 저장 또는 업데이트
 */
async function savePlace(placeData) {
    try {
        const query = `
            INSERT INTO places 
            (place_id, name, description, address, phone, opening_hours, closed_days, latitude, longitude, average_rating) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE 
            name = VALUES(name),
            address = VALUES(address),
            phone = COALESCE(VALUES(phone), phone),
            opening_hours = COALESCE(VALUES(opening_hours), opening_hours),
            closed_days = COALESCE(VALUES(closed_days), closed_days),
            latitude = VALUES(latitude), 
            longitude = VALUES(longitude),
            average_rating = VALUES(average_rating),
            updated_at = CURRENT_TIMESTAMP
        `;

        const params = [
            placeData.place_id,
            placeData.name,
            placeData.description || null,
            placeData.address || null,
            placeData.phone || null,
            placeData.opening_hours || null,
            placeData.closed_days || null,
            placeData.latitude || null,
            placeData.longitude || null,
            placeData.average_rating || null,
        ];

        const [result] = await db.promise().query(query, params);
        return result;
    } catch (error) {
        console.error('장소 저장 중 오류 발생:', error);
        throw error;
    }
}

/**
 * 장소 ID로 장소 정보 조회
 */
async function getPlaceByPlaceId(placeId) {
    try {
        const query = 'SELECT * FROM places WHERE place_id = ?';
        const [rows] = await db.promise().query(query, [placeId]);
        return rows[0] || null;
    } catch (error) {
        console.error('장소 조회 중 오류 발생:', error);
        throw error;
    }
}

/**
 * 장소 이름으로 장소 정보 조회
 */
async function getPlaceByName(placeName) {
    try {
        const query = 'SELECT * FROM places WHERE name LIKE ?';
        const [rows] = await db.promise().query(query, [`%${placeName}%`]);
        return rows[0] || null;
    } catch (error) {
        console.error('장소 이름으로 조회 중 오류 발생:', error);
        throw error;
    }
}

/**
 * 리뷰 저장하기
 */
async function saveReview(reviewData) {
    try {
        const query = `
            INSERT INTO reviews 
            (place_id, place_name, user_name, rating, comment, review_date, source, external_review_id) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE 
            rating = VALUES(rating),
            comment = VALUES(comment),
            updated_at = CURRENT_TIMESTAMP
        `;

        const params = [
            reviewData.place_id,
            reviewData.place_name,
            reviewData.user_name,
            reviewData.rating,
            reviewData.comment || null,
            reviewData.review_date,
            reviewData.source || 'user',
            reviewData.external_review_id || null,
        ];

        const [result] = await db.promise().query(query, params);
        return result;
    } catch (error) {
        console.error('리뷰 저장 중 오류 발생:', error);
        throw error;
    }
}

/**
 * 장소 ID로 리뷰 목록 조회
 */
async function getReviewsByPlaceId(placeId, limit = 10, offset = 0) {
    try {
        const query = `
            SELECT * FROM reviews 
            WHERE place_id = ? 
            ORDER BY review_date DESC 
            LIMIT ? OFFSET ?
        `;

        const [rows] = await db.promise().query(query, [placeId, limit, offset]);
        return rows;
    } catch (error) {
        console.error('리뷰 조회 중 오류 발생:', error);
        throw error;
    }
}

/**
 * 외부 리뷰 ID가 이미 존재하는지 확인 (중복 방지)
 */
async function externalReviewExists(externalReviewId) {
    try {
        const query = 'SELECT COUNT(*) as count FROM reviews WHERE external_review_id = ?';
        const [rows] = await db.promise().query(query, [externalReviewId]);
        return rows[0].count > 0;
    } catch (error) {
        console.error('외부 리뷰 ID 확인 중 오류 발생:', error);
        throw error;
    }
}

/**
 * 장소 활동 정보 저장
 */
async function savePlaceActivity(activityData) {
    try {
        const query = `
            INSERT INTO place_activities 
            (place_id, activity_type, description, recommended_time) 
            VALUES (?, ?, ?, ?)
        `;

        const params = [
            activityData.place_id,
            activityData.activity_type,
            activityData.description || null,
            activityData.recommended_time || null,
        ];

        const [result] = await db.promise().query(query, params);
        return result;
    } catch (error) {
        console.error('장소 활동 정보 저장 중 오류 발생:', error);
        throw error;
    }
}

/**
 * 장소 ID로 활동 정보 조회
 */
async function getActivitiesByPlaceId(placeId) {
    try {
        const query = 'SELECT * FROM place_activities WHERE place_id = ?';
        const [rows] = await db.promise().query(query, [placeId]);
        return rows;
    } catch (error) {
        console.error('장소 활동 정보 조회 중 오류 발생:', error);
        throw error;
    }
}

module.exports = {
    savePlace,
    getPlaceByPlaceId,
    getPlaceByName,
    saveReview,
    getReviewsByPlaceId,
    externalReviewExists,
    savePlaceActivity,
    getActivitiesByPlaceId,
};
