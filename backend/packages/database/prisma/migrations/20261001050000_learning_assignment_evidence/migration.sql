-- Preserve existing learning facts and immutability; admit the explicit admin assignment milestone.
ALTER TABLE learning.learning_progress_event DROP CONSTRAINT learning_progress_event_type_check;
ALTER TABLE learning.learning_progress_event ADD CONSTRAINT learning_progress_event_type_check
 CHECK(event_type IN ('COURSE_ENROLLED','COURSE_ASSIGNED','COURSE_STARTED','LESSON_COMPLETED','COURSE_COMPLETED','ASSESSMENT_COMPLETED'));
CREATE UNIQUE INDEX learning_single_assignment ON learning.learning_progress_event(learning_enrollment_id)
 WHERE event_type='COURSE_ASSIGNED';
ALTER TABLE learning.learning_progress_event ADD CONSTRAINT learning_assignment_no_lesson
 CHECK(event_type<>'COURSE_ASSIGNED' OR learning_lesson_id IS NULL);
