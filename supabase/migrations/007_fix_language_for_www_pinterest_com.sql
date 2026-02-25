-- Fix: Ideas with www.pinterest.com URLs were incorrectly set to language='en'
-- by migration 005. www.pinterest.com is the global domain used by all languages,
-- not just English. Reset these to 'de' (app default) so rescrapes use German
-- Accept-Language headers and return German annotations.
UPDATE public.ideas SET language = 'de'
  WHERE url LIKE '%www.pinterest.com%'
    AND language = 'en';
