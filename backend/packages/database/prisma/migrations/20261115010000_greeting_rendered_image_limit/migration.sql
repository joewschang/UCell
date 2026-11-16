-- Reconcile the existing production 5 MiB rendered-PNG limit.
ALTER TABLE learning.daily_greeting_publication
 DROP CONSTRAINT daily_greeting_publication_image_check,
 ADD CONSTRAINT daily_greeting_publication_image_check CHECK (octet_length(image) <= 5242880);
