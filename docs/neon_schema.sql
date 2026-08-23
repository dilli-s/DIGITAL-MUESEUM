BEGIN;

CREATE TABLE alembic_version (
    version_num VARCHAR(32) NOT NULL, 
    CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num)
);

-- Running upgrade  -> 4fc2a1874c2f

CREATE TABLE museums (
    id SERIAL NOT NULL, 
    name VARCHAR(255) NOT NULL, 
    description TEXT, 
    location VARCHAR(255), 
    image VARCHAR(255), 
    created_at TIMESTAMP WITHOUT TIME ZONE, 
    updated_at TIMESTAMP WITHOUT TIME ZONE, 
    PRIMARY KEY (id)
);

CREATE TABLE collections (
    id SERIAL NOT NULL, 
    museum_id INTEGER NOT NULL, 
    name VARCHAR(255) NOT NULL, 
    description TEXT, 
    image VARCHAR(255), 
    created_at TIMESTAMP WITHOUT TIME ZONE, 
    updated_at TIMESTAMP WITHOUT TIME ZONE, 
    PRIMARY KEY (id), 
    FOREIGN KEY(museum_id) REFERENCES museums (id)
);

CREATE TABLE exhibitions (
    id SERIAL NOT NULL, 
    museum_id INTEGER NOT NULL, 
    title VARCHAR(255) NOT NULL, 
    subtitle VARCHAR(255), 
    description TEXT, 
    long_description TEXT, 
    image VARCHAR(255), 
    category VARCHAR(100), 
    theme VARCHAR(100), 
    period VARCHAR(100), 
    location VARCHAR(255), 
    start_date DATE, 
    end_date DATE, 
    featured BOOLEAN, 
    created_at TIMESTAMP WITHOUT TIME ZONE, 
    updated_at TIMESTAMP WITHOUT TIME ZONE, 
    PRIMARY KEY (id), 
    FOREIGN KEY(museum_id) REFERENCES museums (id)
);

CREATE TABLE galleries (
    id SERIAL NOT NULL, 
    museum_id INTEGER NOT NULL, 
    name VARCHAR(255) NOT NULL, 
    description TEXT, 
    image VARCHAR(255), 
    created_at TIMESTAMP WITHOUT TIME ZONE, 
    updated_at TIMESTAMP WITHOUT TIME ZONE, 
    PRIMARY KEY (id), 
    FOREIGN KEY(museum_id) REFERENCES museums (id)
);

CREATE TABLE objects (
    id SERIAL NOT NULL, 
    museum_id INTEGER NOT NULL, 
    gallery_id INTEGER, 
    collection_id INTEGER, 
    name VARCHAR(255) NOT NULL, 
    description TEXT, 
    image VARCHAR(255), 
    object_code VARCHAR(100), 
    period VARCHAR(100), 
    origin VARCHAR(100), 
    category VARCHAR(100), 
    featured BOOLEAN, 
    created_at TIMESTAMP WITHOUT TIME ZONE, 
    updated_at TIMESTAMP WITHOUT TIME ZONE, 
    PRIMARY KEY (id), 
    FOREIGN KEY(collection_id) REFERENCES collections (id), 
    FOREIGN KEY(gallery_id) REFERENCES galleries (id), 
    FOREIGN KEY(museum_id) REFERENCES museums (id), 
    UNIQUE (object_code)
);

CREATE TABLE activities (
    id SERIAL NOT NULL, 
    object_id INTEGER NOT NULL, 
    title VARCHAR(255) NOT NULL, 
    description TEXT, 
    type VARCHAR(50), 
    difficulty VARCHAR(50), 
    questions JSON, 
    created_at TIMESTAMP WITHOUT TIME ZONE, 
    updated_at TIMESTAMP WITHOUT TIME ZONE, 
    PRIMARY KEY (id), 
    FOREIGN KEY(object_id) REFERENCES objects (id)
);

CREATE TABLE exhibition_objects (
    exhibition_id INTEGER NOT NULL, 
    object_id INTEGER NOT NULL, 
    PRIMARY KEY (exhibition_id, object_id), 
    FOREIGN KEY(exhibition_id) REFERENCES exhibitions (id), 
    FOREIGN KEY(object_id) REFERENCES objects (id)
);

CREATE TABLE learning_resources (
    id SERIAL NOT NULL, 
    object_id INTEGER NOT NULL, 
    title VARCHAR(255) NOT NULL, 
    description TEXT, 
    type VARCHAR(50), 
    content JSON, 
    duration VARCHAR(50), 
    difficulty VARCHAR(50), 
    featured BOOLEAN, 
    created_at TIMESTAMP WITHOUT TIME ZONE, 
    updated_at TIMESTAMP WITHOUT TIME ZONE, 
    PRIMARY KEY (id), 
    FOREIGN KEY(object_id) REFERENCES objects (id)
);

CREATE TABLE stories (
    id SERIAL NOT NULL, 
    object_id INTEGER NOT NULL, 
    title VARCHAR(255) NOT NULL, 
    summary TEXT, 
    image VARCHAR(255), 
    content JSON, 
    duration VARCHAR(50), 
    created_at TIMESTAMP WITHOUT TIME ZONE, 
    updated_at TIMESTAMP WITHOUT TIME ZONE, 
    PRIMARY KEY (id), 
    FOREIGN KEY(object_id) REFERENCES objects (id)
);

INSERT INTO alembic_version (version_num) VALUES ('4fc2a1874c2f') RETURNING alembic_version.version_num;

-- Running upgrade 4fc2a1874c2f -> 1b09abc92b0f

ALTER TABLE learning_resources ADD COLUMN category VARCHAR(50);

UPDATE alembic_version SET version_num='1b09abc92b0f' WHERE alembic_version.version_num = '4fc2a1874c2f';

-- Running upgrade 1b09abc92b0f -> c089afc81755

CREATE TABLE users (
    id SERIAL NOT NULL, 
    name VARCHAR(255) NOT NULL, 
    email VARCHAR(255) NOT NULL, 
    password_hash VARCHAR(255) NOT NULL, 
    created_at TIMESTAMP WITHOUT TIME ZONE, 
    updated_at TIMESTAMP WITHOUT TIME ZONE, 
    PRIMARY KEY (id)
);

CREATE UNIQUE INDEX ix_users_email ON users (email);

UPDATE alembic_version SET version_num='c089afc81755' WHERE alembic_version.version_num = '1b09abc92b0f';

-- Running upgrade c089afc81755 -> bf038bb3efe8

CREATE TABLE bookmarks (
    id SERIAL NOT NULL, 
    user_id INTEGER NOT NULL, 
    content_type VARCHAR(50) NOT NULL, 
    content_id INTEGER NOT NULL, 
    created_at TIMESTAMP WITHOUT TIME ZONE, 
    PRIMARY KEY (id), 
    FOREIGN KEY(user_id) REFERENCES users (id), 
    CONSTRAINT uq_bookmark_user_content UNIQUE (user_id, content_type, content_id)
);

CREATE INDEX ix_bookmarks_content_id ON bookmarks (content_id);

CREATE INDEX ix_bookmarks_content_type ON bookmarks (content_type);

CREATE INDEX ix_bookmarks_user_id ON bookmarks (user_id);

UPDATE alembic_version SET version_num='bf038bb3efe8' WHERE alembic_version.version_num = 'c089afc81755';

-- Running upgrade bf038bb3efe8 -> 5088b359b6e2

CREATE TABLE learning_progress (
    id SERIAL NOT NULL, 
    user_id INTEGER NOT NULL, 
    learning_id INTEGER NOT NULL, 
    status VARCHAR(50) NOT NULL, 
    progress INTEGER NOT NULL, 
    started_at TIMESTAMP WITHOUT TIME ZONE, 
    completed_at TIMESTAMP WITHOUT TIME ZONE, 
    updated_at TIMESTAMP WITHOUT TIME ZONE, 
    PRIMARY KEY (id), 
    FOREIGN KEY(learning_id) REFERENCES learning_resources (id), 
    FOREIGN KEY(user_id) REFERENCES users (id), 
    CONSTRAINT uq_learning_progress_user UNIQUE (user_id, learning_id)
);

CREATE INDEX ix_learning_progress_learning_id ON learning_progress (learning_id);

CREATE INDEX ix_learning_progress_user_id ON learning_progress (user_id);

UPDATE alembic_version SET version_num='5088b359b6e2' WHERE alembic_version.version_num = 'bf038bb3efe8';

-- Running upgrade 5088b359b6e2 -> c42efabce836

CREATE TABLE user_history (
    id SERIAL NOT NULL, 
    user_id INTEGER NOT NULL, 
    content_type VARCHAR(50) NOT NULL, 
    content_id INTEGER NOT NULL, 
    action VARCHAR(50) NOT NULL, 
    created_at TIMESTAMP WITHOUT TIME ZONE, 
    PRIMARY KEY (id), 
    FOREIGN KEY(user_id) REFERENCES users (id)
);

CREATE INDEX ix_user_history_content_id ON user_history (content_id);

CREATE INDEX ix_user_history_content_type ON user_history (content_type);

CREATE INDEX ix_user_history_created_at ON user_history (created_at);

CREATE INDEX ix_user_history_user_id ON user_history (user_id);

CREATE TABLE activity_progress (
    id SERIAL NOT NULL, 
    user_id INTEGER NOT NULL, 
    activity_id INTEGER NOT NULL, 
    status VARCHAR(50) NOT NULL, 
    score INTEGER, 
    completed BOOLEAN, 
    started_at TIMESTAMP WITHOUT TIME ZONE, 
    completed_at TIMESTAMP WITHOUT TIME ZONE, 
    updated_at TIMESTAMP WITHOUT TIME ZONE, 
    PRIMARY KEY (id), 
    FOREIGN KEY(activity_id) REFERENCES activities (id), 
    FOREIGN KEY(user_id) REFERENCES users (id), 
    CONSTRAINT uq_activity_progress_user UNIQUE (user_id, activity_id)
);

CREATE INDEX ix_activity_progress_activity_id ON activity_progress (activity_id);

CREATE INDEX ix_activity_progress_user_id ON activity_progress (user_id);

UPDATE alembic_version SET version_num='c42efabce836' WHERE alembic_version.version_num = '5088b359b6e2';

-- Running upgrade c42efabce836 -> f93f52170e10

ALTER TABLE users ADD COLUMN role VARCHAR(50) DEFAULT 'user' NOT NULL;

UPDATE alembic_version SET version_num='f93f52170e10' WHERE alembic_version.version_num = 'c42efabce836';

COMMIT;

