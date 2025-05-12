-- 장소 정보 테이블
CREATE TABLE IF NOT EXISTS places (
    id INT AUTO_INCREMENT PRIMARY KEY,
    place_id VARCHAR(255) NOT NULL UNIQUE COMMENT 'Google Places API place_id',
    name VARCHAR(255) NOT NULL,
    description TEXT,
    address TEXT,
    phone VARCHAR(20),
    opening_hours TEXT,
    closed_days TEXT,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    average_rating DECIMAL(3, 2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_place_id (place_id),
    INDEX idx_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 리뷰 테이블
CREATE TABLE IF NOT EXISTS reviews (
    id INT AUTO_INCREMENT PRIMARY KEY,
    place_id VARCHAR(255) NOT NULL COMMENT 'Google Places API place_id',
    place_name VARCHAR(255) NOT NULL,
    user_name VARCHAR(255) NOT NULL,
    rating DECIMAL(3, 2) NOT NULL,
    comment TEXT,
    review_date DATE NOT NULL,
    source ENUM('google', 'user') NOT NULL DEFAULT 'user',
    external_review_id VARCHAR(255) COMMENT 'Google 리뷰 ID 또는 기타 외부 ID',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (place_id) REFERENCES places(place_id) ON DELETE CASCADE,
    INDEX idx_place_id (place_id),
    INDEX idx_review_date (review_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 장소 관련 활동 정보 테이블
CREATE TABLE IF NOT EXISTS place_activities (
    id INT AUTO_INCREMENT PRIMARY KEY,
    place_id VARCHAR(255) NOT NULL,
    activity_type VARCHAR(100) NOT NULL,
    description TEXT,
    recommended_time VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (place_id) REFERENCES places(place_id) ON DELETE CASCADE,
    INDEX idx_place_id (place_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 사용자 즐겨찾기 테이블
CREATE TABLE IF NOT EXISTS favorites (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(100) NOT NULL COMMENT 'Firebase UID',
    place_id VARCHAR(255) NOT NULL COMMENT 'Google Places API place_id',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (place_id) REFERENCES places(place_id) ON DELETE CASCADE,
    UNIQUE KEY unique_favorite (user_id, place_id) COMMENT '한 유저가 같은 장소를 중복 즐겨찾기할 수 없도록 제약',
    INDEX idx_user_id (user_id),
    INDEX idx_place_id (place_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4; 