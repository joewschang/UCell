CREATE SCHEMA IF NOT EXISTS learning;

CREATE TYPE learning."LearningCourseStatus" AS ENUM ('DRAFT','PUBLISHED','ARCHIVED');
CREATE TYPE learning."LearningEnrollmentStatus" AS ENUM ('ENROLLED','STARTED','COMPLETED','CANCELLED');

CREATE TABLE learning.learning_course (
 learning_course_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), course_code text NOT NULL UNIQUE,
 status learning."LearningCourseStatus" NOT NULL DEFAULT 'DRAFT', created_by_actor text NOT NULL,
 created_at timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX learning_course_status_created_idx ON learning.learning_course(status,created_at);

CREATE TABLE learning.learning_course_version (
 learning_course_version_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), learning_course_id uuid NOT NULL REFERENCES learning.learning_course(learning_course_id),
 version integer NOT NULL, title text NOT NULL, summary text, category_code text NOT NULL, audience_policy text NOT NULL DEFAULT 'NETWORK_MEMBER',
 publish_from timestamptz(6), publish_to timestamptz(6), approval_reference text, approved_by_actor text, approved_at timestamptz(6),
 content_hash char(64) NOT NULL, status learning."LearningCourseStatus" NOT NULL DEFAULT 'DRAFT', created_at timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT learning_course_version_course_version_key UNIQUE(learning_course_id,version),
 CONSTRAINT learning_course_version_window_check CHECK(publish_to IS NULL OR publish_from IS NULL OR publish_to > publish_from),
 CONSTRAINT learning_course_version_hash_check CHECK(content_hash ~ '^[a-f0-9]{64}$')
);
CREATE INDEX learning_course_version_visible_idx ON learning.learning_course_version(status,audience_policy,publish_from,publish_to);

CREATE TABLE learning.learning_lesson (
 learning_lesson_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), learning_course_version_id uuid NOT NULL REFERENCES learning.learning_course_version(learning_course_version_id),
 sequence_no integer NOT NULL CHECK(sequence_no > 0), title text NOT NULL, content_type text NOT NULL, content_reference text NOT NULL,
 required boolean NOT NULL DEFAULT true, created_at timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT learning_lesson_version_sequence_key UNIQUE(learning_course_version_id,sequence_no),
 CONSTRAINT learning_lesson_type_check CHECK(content_type IN ('VIDEO_REFERENCE','DOCUMENT_REFERENCE','ARTICLE','EXTERNAL_LINK'))
);

CREATE TABLE learning.learning_enrollment (
 learning_enrollment_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), learning_course_id uuid NOT NULL REFERENCES learning.learning_course(learning_course_id),
 learning_course_version_id uuid NOT NULL REFERENCES learning.learning_course_version(learning_course_version_id), person_id uuid NOT NULL REFERENCES identity.person(person_id),
 status learning."LearningEnrollmentStatus" NOT NULL DEFAULT 'ENROLLED', assigned_by_actor text, enrolled_at timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 started_at timestamptz(6), completed_at timestamptz(6), assessment_score numeric(7,4),
 CONSTRAINT learning_enrollment_course_person_key UNIQUE(learning_course_id,person_id),
 CONSTRAINT learning_enrollment_times_check CHECK((started_at IS NULL OR started_at >= enrolled_at) AND (completed_at IS NULL OR started_at IS NOT NULL AND completed_at >= started_at))
);
CREATE INDEX learning_enrollment_person_status_idx ON learning.learning_enrollment(person_id,status,enrolled_at);

CREATE TABLE learning.learning_progress_event (
 learning_progress_event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), learning_enrollment_id uuid NOT NULL REFERENCES learning.learning_enrollment(learning_enrollment_id),
 learning_lesson_id uuid REFERENCES learning.learning_lesson(learning_lesson_id), event_type text NOT NULL, occurred_at timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 idempotency_key text NOT NULL UNIQUE, evidence_hash char(64) NOT NULL,
 CONSTRAINT learning_progress_event_type_check CHECK(event_type IN ('COURSE_ENROLLED','COURSE_STARTED','LESSON_COMPLETED','COURSE_COMPLETED','ASSESSMENT_COMPLETED')),
 CONSTRAINT learning_progress_event_hash_check CHECK(evidence_hash ~ '^[a-f0-9]{64}$')
);
CREATE INDEX learning_progress_event_enrollment_time_idx ON learning.learning_progress_event(learning_enrollment_id,occurred_at);
