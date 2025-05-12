const fetch = require('node-fetch');
require('dotenv').config();

// 환경변수에서 API 키 가져오기
const DEFAULT_API_KEY = process.env.GOOGLE_MAPS_API_KEY || '';

/**
 * 장소 이름으로 Google Place ID 검색
 */
async function findPlaceId(placeName, apiKey = DEFAULT_API_KEY) {
    try {
        const url = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(
            placeName
        )}&inputtype=textquery&fields=place_id,name,formatted_address&key=${apiKey}`;

        const response = await fetch(url);
        const data = await response.json();

        if (data.status === 'OK' && data.candidates && data.candidates.length > 0) {
            return {
                success: true,
                placeId: data.candidates[0].place_id,
                name: data.candidates[0].name,
                address: data.candidates[0].formatted_address,
            };
        }

        return {
            success: false,
            error: `장소를 찾을 수 없습니다: ${placeName}`,
        };
    } catch (error) {
        console.error('Google Places API 호출 중 오류 발생:', error);
        return {
            success: false,
            error: '서버 오류가 발생했습니다.',
        };
    }
}

/**
 * 장소 ID로 상세 정보 및 리뷰 가져오기
 */
async function getPlaceDetails(placeId, apiKey = DEFAULT_API_KEY) {
    try {
        const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,rating,formatted_address,geometry,reviews,formatted_phone_number,opening_hours&key=${apiKey}`;

        const response = await fetch(url);
        const data = await response.json();

        if (data.status === 'OK' && data.result) {
            // 리뷰 데이터 형식 변환
            const reviews = data.result.reviews
                ? data.result.reviews.map((review, index) => ({
                      external_review_id: `google-${placeId}-${index}`,
                      user_name: review.author_name,
                      rating: review.rating,
                      comment: review.text,
                      review_date: new Date(review.time * 1000).toISOString().split('T')[0],
                      source: 'google',
                  }))
                : [];

            // 영업 시간 형식 변환
            let formattedOpeningHours = null;
            if (data.result.opening_hours && data.result.opening_hours.weekday_text) {
                formattedOpeningHours = data.result.opening_hours.weekday_text.join('\n');
            }

            return {
                success: true,
                placeDetails: {
                    place_id: placeId,
                    name: data.result.name,
                    address: data.result.formatted_address,
                    phone: data.result.formatted_phone_number || null,
                    opening_hours: formattedOpeningHours,
                    average_rating: data.result.rating || 0,
                    latitude: data.result.geometry?.location?.lat,
                    longitude: data.result.geometry?.location?.lng,
                    reviews: reviews,
                },
            };
        }

        return {
            success: false,
            error: `장소 상세 정보를 찾을 수 없습니다: ${placeId}`,
        };
    } catch (error) {
        console.error('Google Places API 상세 정보 호출 중 오류 발생:', error);
        return {
            success: false,
            error: '서버 오류가 발생했습니다.',
        };
    }
}

module.exports = {
    findPlaceId,
    getPlaceDetails,
};
