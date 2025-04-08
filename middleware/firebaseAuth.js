const admin = require('../firebaseAdmin');

const authenticateFirebaseToken = async (req, res, next) => {
    const authHeader = req.headers.authorization;

    // 헤더에 토큰이 없으면 401 에러 반환
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: '토큰이 제공되지 않았습니다.' });
    }

    const idToken = authHeader.split('Bearer ')[1];

    try {
        // Firebase Admin으로 토큰 검증
        const decodedToken = await admin.auth().verifyIdToken(idToken);

        // 성공 시 요청 객체에 유저 정보 저장
        req.firebaseUser = decodedToken;

        // 다음 미들웨어 또는 라우터로 진행
        next();
    } catch (error) {
        console.error('토큰 검증 실패:', error);
        return res.status(403).json({ error: '유효하지 않은 토큰입니다.' });
    }
};

module.exports = authenticateFirebaseToken;
