const express = require('express');
const router = express.Router();
const googlePlacesApi = require('../utils/googlePlacesApi');
const placeRepository = require('../database/placeRepository');
const authenticateFirebaseToken = require('../middleware/firebaseAuth');
const db = require('../database/db_connect');

/**
 * 장소 이름으로 검색
 */
router.post('/search', async (req, res) => {
    try {
        const { placeName, apiKey } = req.body;

        if (!placeName) {
            return res.status(400).json({
                success: false,
                error: '장소 이름이 필요합니다.',
            });
        }

        const result = await googlePlacesApi.findPlaceId(placeName, apiKey);

        if (!result.success) {
            return res.status(404).json({
                success: false,
                error: result.error,
            });
        }

        res.json({
            success: true,
            placeId: result.placeId,
            name: result.name,
            address: result.address,
        });
    } catch (error) {
        console.error('장소 검색 중 오류 발생:', error);
        res.status(500).json({
            success: false,
            error: '서버 오류가 발생했습니다.',
        });
    }
});

/**
 * 장소 이름으로 장소 정보 조회
 */
router.get('/by-name/:placeName', async (req, res) => {
    try {
        const { placeName } = req.params;

        // 데이터베이스에서 장소 검색
        const place = await placeRepository.getPlaceByName(placeName);

        if (place) {
            return res.json({
                success: true,
                ...place,
            });
        }

        res.status(404).json({
            success: false,
            error: '장소를 찾을 수 없습니다.',
        });
    } catch (error) {
        console.error('장소 이름으로 조회 중 오류 발생:', error);
        res.status(500).json({
            success: false,
            error: '서버 오류가 발생했습니다.',
        });
    }
});

/**
 * Google Places API에서 장소 리뷰 가져와서 DB에 저장
 */
router.post('/sync-reviews', async (req, res) => {
    try {
        const { placeId, placeName, apiKey } = req.body;

        if (!placeId) {
            return res.status(400).json({
                success: false,
                error: '장소 ID가 필요합니다.',
            });
        }

        // Google Places API에서 장소 상세 정보 가져오기
        const placeDetailsResult = await googlePlacesApi.getPlaceDetails(placeId, apiKey);

        if (!placeDetailsResult.success) {
            return res.status(404).json({
                success: false,
                error: placeDetailsResult.error,
            });
        }

        const placeDetails = placeDetailsResult.placeDetails;

        // 장소 정보 저장
        await placeRepository.savePlace({
            place_id: placeDetails.place_id,
            name: placeDetails.name,
            address: placeDetails.address,
            phone: placeDetails.phone,
            opening_hours: placeDetails.opening_hours,
            latitude: placeDetails.latitude,
            longitude: placeDetails.longitude,
            average_rating: placeDetails.average_rating,
        });

        // 리뷰 저장
        const savedReviews = [];

        for (const review of placeDetails.reviews) {
            // 이미 저장된 리뷰인지 확인 (중복 방지)
            const exists = await placeRepository.externalReviewExists(review.external_review_id);

            if (!exists) {
                await placeRepository.saveReview({
                    place_id: placeDetails.place_id,
                    place_name: placeDetails.name,
                    user_name: review.user_name,
                    rating: review.rating,
                    comment: review.comment,
                    review_date: review.review_date,
                    source: review.source,
                    external_review_id: review.external_review_id,
                });

                savedReviews.push(review);
            }
        }

        res.json({
            success: true,
            message: `${savedReviews.length}개의 리뷰가 동기화되었습니다.`,
            reviews: savedReviews,
        });
    } catch (error) {
        console.error('리뷰 동기화 중 오류 발생:', error);
        res.status(500).json({
            success: false,
            error: '서버 오류가 발생했습니다.',
        });
    }
});

// ================================
// 즐겨찾기 관련 라우트 - 먼저 정의
// ================================

/**
 * 사용자의 모든 즐겨찾기 가져오기
 */
router.get('/favorites', authenticateFirebaseToken, async (req, res) => {
    try {
        const user_id = req.firebaseUser.uid;

        console.log(`즐겨찾기 목록 조회 요청: user_id=${user_id}`);

        const getFavoritesSql = `
            SELECT f.id, p.place_id, p.name, p.address, p.latitude, p.longitude, f.created_at
            FROM favorites f
            JOIN places p ON f.place_id = p.place_id
            WHERE f.user_id = ?
            ORDER BY f.created_at DESC
        `;

        db.query(getFavoritesSql, [user_id], (error, results) => {
            if (error) {
                console.error('즐겨찾기 목록 조회 중 오류 발생:', error);
                return res.status(500).json({
                    success: false,
                    error: '서버 오류가 발생했습니다.',
                });
            }

            console.log(`즐겨찾기 목록 조회 결과: ${results.length}개 항목 반환`);
            res.json({
                success: true,
                favorites: results,
            });
        });
    } catch (error) {
        console.error('즐겨찾기 목록 조회 중 오류 발생:', error);
        res.status(500).json({
            success: false,
            error: '서버 오류가 발생했습니다.',
        });
    }
});

/**
 * 즐겨찾기 상태 확인
 */
router.get('/favorites/:place_id', authenticateFirebaseToken, async (req, res) => {
    try {
        const { place_id } = req.params;
        const user_id = req.firebaseUser.uid;

        console.log(`즐겨찾기 상태 확인 요청: user_id=${user_id}, place_id=${place_id}`);

        const checkFavoriteSql = 'SELECT id FROM favorites WHERE user_id = ? AND place_id = ?';

        db.query(checkFavoriteSql, [user_id, place_id], (error, results) => {
            if (error) {
                console.error('즐겨찾기 상태 확인 중 오류 발생:', error);
                return res.status(500).json({
                    success: false,
                    error: '서버 오류가 발생했습니다.',
                });
            }

            const isFavorite = results.length > 0;
            console.log(`즐겨찾기 상태 확인 결과: isFavorite=${isFavorite}`);

            res.json({
                success: true,
                isFavorite: isFavorite,
            });
        });
    } catch (error) {
        console.error('즐겨찾기 상태 확인 중 오류 발생:', error);
        res.status(500).json({
            success: false,
            error: '서버 오류가 발생했습니다.',
        });
    }
});

/**
 * 즐겨찾기 추가
 */
router.post('/favorites', authenticateFirebaseToken, async (req, res) => {
    try {
        const { place_id } = req.body;
        const user_id = req.firebaseUser.uid;

        console.log(`즐겨찾기 추가 요청: user_id=${user_id}, place_id=${place_id}`);

        if (!place_id) {
            return res.status(400).json({
                success: false,
                error: '장소 ID가 필요합니다.',
            });
        }

        // 장소가 places 테이블에 존재하는지 먼저 확인
        const checkPlaceSql = 'SELECT id FROM places WHERE place_id = ?';

        db.query(checkPlaceSql, [place_id], async (error, results) => {
            if (error) {
                console.error('장소 확인 중 오류 발생:', error);
                return res.status(500).json({
                    success: false,
                    error: '서버 오류가 발생했습니다.',
                });
            }

            // 장소가 존재하지 않는 경우 임시 장소 정보 추가
            if (results.length === 0) {
                console.log(`장소 ${place_id}가 존재하지 않아 임시 데이터 생성 시도`);
                try {
                    // 임시 장소 정보를 places 테이블에 저장
                    const addTempPlaceSql = `
                        INSERT INTO places (place_id, name, created_at, updated_at)
                        VALUES (?, ?, NOW(), NOW())
                    `;

                    await new Promise((resolve, reject) => {
                        db.query(
                            addTempPlaceSql,
                            [place_id, `임시 장소 ${place_id.substring(0, 8)}`],
                            (err, result) => {
                                if (err) {
                                    console.error('임시 장소 추가 중 오류 발생:', err);
                                    reject(err);
                                } else {
                                    console.log('임시 장소 추가 성공');
                                    resolve(result);
                                }
                            }
                        );
                    });
                } catch (placeError) {
                    return res.status(500).json({
                        success: false,
                        error: '장소 정보 저장 중 오류가 발생했습니다.',
                    });
                }
            }

            // 즐겨찾기 추가
            const addFavoriteSql = 'INSERT INTO favorites (user_id, place_id) VALUES (?, ?)';

            db.query(addFavoriteSql, [user_id, place_id], (error, result) => {
                if (error) {
                    // 중복 키 오류(이미 즐겨찾기에 추가된 경우)
                    if (error.code === 'ER_DUP_ENTRY') {
                        return res.status(409).json({
                            success: false,
                            error: '이미 즐겨찾기에 추가된 장소입니다.',
                        });
                    }

                    console.error('즐겨찾기 추가 중 오류 발생:', error);
                    return res.status(500).json({
                        success: false,
                        error: '서버 오류가 발생했습니다.',
                    });
                }

                console.log(`즐겨찾기 추가 성공: user_id=${user_id}, place_id=${place_id}`);
                res.json({
                    success: true,
                    message: '즐겨찾기에 추가되었습니다.',
                });
            });
        });
    } catch (error) {
        console.error('즐겨찾기 추가 중 오류 발생:', error);
        res.status(500).json({
            success: false,
            error: '서버 오류가 발생했습니다.',
        });
    }
});

/**
 * 즐겨찾기 제거
 */
router.delete('/favorites', authenticateFirebaseToken, async (req, res) => {
    try {
        const { place_id } = req.body;
        const user_id = req.firebaseUser.uid;

        if (!place_id) {
            return res.status(400).json({
                success: false,
                error: '장소 ID가 필요합니다.',
            });
        }

        const deleteFavoriteSql = 'DELETE FROM favorites WHERE user_id = ? AND place_id = ?';

        db.query(deleteFavoriteSql, [user_id, place_id], (error, result) => {
            if (error) {
                console.error('즐겨찾기 제거 중 오류 발생:', error);
                return res.status(500).json({
                    success: false,
                    error: '서버 오류가 발생했습니다.',
                });
            }

            if (result.affectedRows === 0) {
                return res.status(404).json({
                    success: false,
                    error: '즐겨찾기에 없는 장소입니다.',
                });
            }

            res.json({
                success: true,
                message: '즐겨찾기에서 제거되었습니다.',
            });
        });
    } catch (error) {
        console.error('즐겨찾기 제거 중 오류 발생:', error);
        res.status(500).json({
            success: false,
            error: '서버 오류가 발생했습니다.',
        });
    }
});

// ================================
// 장소 상세 조회 라우트
// ================================

/**
 * 장소 정보 및 리뷰 가져오기
 */
router.get('/:placeId/details', async (req, res) => {
    try {
        const { placeId } = req.params;
        const limit = parseInt(req.query.limit) || 10;
        const offset = parseInt(req.query.offset) || 0;

        // 데이터베이스에서 장소 정보 조회
        const place = await placeRepository.getPlaceByPlaceId(placeId);

        if (!place) {
            return res.status(404).json({
                success: false,
                error: '장소를 찾을 수 없습니다.',
            });
        }

        // 장소의 리뷰 조회
        const reviews = await placeRepository.getReviewsByPlaceId(placeId, limit, offset);

        // 장소의 활동 정보 조회
        const activities = await placeRepository.getActivitiesByPlaceId(placeId);

        res.json({
            success: true,
            ...place,
            reviews,
            activities,
        });
    } catch (error) {
        console.error('장소 상세 정보 조회 중 오류 발생:', error);
        res.status(500).json({
            success: false,
            error: '서버 오류가 발생했습니다.',
        });
    }
});

/**
 * 장소 ID로 장소 정보 조회 - 가장 마지막에 정의하여 다른 라우트와 충돌하지 않도록 함
 */
router.get('/:placeId', async (req, res) => {
    try {
        const { placeId } = req.params;

        // favorites 경로 충돌 방지 - 이 패턴을 사용하면 다른 경로와 충돌 가능성이 있음
        if (placeId === 'favorites') {
            return res.status(404).json({
                success: false,
                error: '잘못된 요청입니다. /places/favorites 엔드포인트를 사용하세요.',
            });
        }

        // 데이터베이스에서 장소 검색
        const place = await placeRepository.getPlaceByPlaceId(placeId);

        if (place) {
            // 장소의 활동 정보 가져오기
            const activities = await placeRepository.getActivitiesByPlaceId(placeId);

            return res.json({
                success: true,
                ...place,
                activities,
            });
        }

        res.status(404).json({
            success: false,
            error: '장소를 찾을 수 없습니다.',
        });
    } catch (error) {
        console.error('장소 ID로 조회 중 오류 발생:', error);
        res.status(500).json({
            success: false,
            error: '서버 오류가 발생했습니다.',
        });
    }
});

module.exports = router;
