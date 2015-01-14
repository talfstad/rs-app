DELIMITER //
CREATE PROCEDURE insert_domain
(IN in_url VARCHAR(1000),
 IN in_user VARCHAR(100),
 IN in_date DATETIME,
 IN in_base_url VARCHAR(200))
BEGIN
    IF (in_url != '' AND in_url IS NOT NULL) THEN
        IF EXISTS (SELECT * FROM all_domains WHERE (url = in_url AND user = in_user)) THEN
                UPDATE all_domains SET count = count + 1 WHERE (url = in_url AND user = in_user);
        ELSE
            IF EXISTS (SELECT url FROM my_domains WHERE (in_base_url = my_domains.base_url AND my_domains.user = in_user)) THEN
                INSERT INTO all_domains (url, registered, count, user, creation_date, base_url) VALUES(in_url, 1, 1, in_user, in_date, in_base_url);
            ELSE
                INSERT INTO all_domains (url, registered, count, user, creation_date, base_url) VALUES(in_url, 0, 1, in_user, in_date, in_base_url);
            END IF;
        END IF;
    END IF;
END ; //
DELIMITER ;

DELIMITER //
CREATE PROCEDURE test_proc
(IN in_url VARCHAR(1000))
BEGIN
    INSERT INTO all_domains (url, registered) VALUES(in_url, 1);
END; //
DELIMITER ;

DELIMITER //
CREATE PROCEDURE insert_my_domain
(IN in_url VARCHAR(200),
 IN in_user VARCHAR(100))
BEGIN
    UPDATE all_domains SET registered=1 WHERE all_domains.base_url = in_url AND all_domains.user = in_user;
    INSERT INTO my_domains (url, user) VALUES(in_url, in_user);

END ; //
DELIMITER ;

DELIMITER //
CREATE PROCEDURE get_links 
(IN in_url VARCHAR(200),
 IN in_user VARCHAR(100))
BEGIN
    SELECT links.domain, links.link, links.bc_link, links.user_link, all_domains.rate, all_domains.bc_rate
    FROM links
    INNER JOIN all_domains
    ON links.domain = all_domains.url
    WHERE in_url = links.domain AND in_user = links.user AND in_user = all_domains.user;
END ; //
DELIMITER ;

DELIMITER //
CREATE PROCEDURE test_query
(IN in_url VARCHAR(200))
BEGIN
    SELECT * FROM all_domains where url like in_url;
END ; //
DELIMITER ;

DELIMITER //
CREATE PROCEDURE insert_user_link
(IN in_domain VARCHAR(200),
 IN in_link VARCHAR(200),
 IN in_user_link VARCHAR(200),
 IN in_user VARCHAR(100))
BEGIN
    IF EXISTS (SELECT * FROM links WHERE (domain = in_domain AND link = in_link AND user = in_user)) THEN
         UPDATE links SET user_link = in_user_link WHERE (links.domain = in_domain AND link = in_link AND user = in_user);
    ELSE
        INSERT INTO links (domain, link, user_link, user) VALUES(in_domain, in_link, in_user_link, in_user);
    END IF;
END ; //
DELIMITER ;

DELIMITER //
CREATE PROCEDURE insert_link
(IN in_domain VARCHAR(200),
 IN in_link VARCHAR(200),
 IN in_user VARCHAR(100))
BEGIN
    IF NOT EXISTS (SELECT * FROM links WHERE (domain = in_domain AND link = in_link AND user = in_user)) THEN
        INSERT INTO links (domain, link, user) VALUES(in_domain, in_link, in_user);
    END IF;
END ; //
DELIMITER ;

DELIMITER //
CREATE PROCEDURE delete_my_domain
(IN in_id int,
 IN in_user VARCHAR(100))
BEGIN
    SELECT url INTO @var_url FROM my_domains WHERE id = in_id LIMIT 1;
    DELETE from my_domains where id = in_id; UPDATE all_domains set registered = 0 WHERE user = in_user AND base_url = @var_url;
END //
DELIMITER ;

DELIMITER //
CREATE DEFINER=`root`@`%` PROCEDURE `increment_hits`(IN `in_url` VARCHAR(200), IN `in_uuid` VARCHAR(200))
    LANGUAGE SQL
    NOT DETERMINISTIC
    CONTAINS SQL
    SQL SECURITY DEFINER
    COMMENT ''
BEGIN
    UPDATE lander_info SET hits=hits+1 WHERE url=in_url and uuid=in_uuid;
END; //
DELIMITER ;

CREATE DEFINER=`root`@`%` FUNCTION `process_request`(`in_url` TEXT, `in_uuid` VARCHAR(200), `in_time` DATETIME, `in_domain` VARCHAR(300), `in_links` TEXT, `in_full_url` TEXT, `in_country_code` VARCHAR(50))
    RETURNS varchar(50) CHARSET latin1
    LANGUAGE SQL
    NOT DETERMINISTIC
    CONTAINS SQL
    SQL SECURITY DEFINER
    COMMENT ''
BEGIN
    DECLARE ret_val VARCHAR(50);
    SELECT user INTO @var_user FROM lander_info WHERE uuid=in_uuid LIMIT 1;
    IF EXISTS (SELECT * FROM lander_info WHERE uuid=in_uuid AND url=in_url) THEN
        UPDATE lander_info SET hits=hits+1,last_updated=NOW() WHERE url=in_url and uuid=in_uuid;
        SET ret_val = 'OLD_REGISTERED';             
    ELSEIF EXISTS (SELECT * FROM lander_info WHERE uuid=in_uuid AND url IS NULL) THEN
        UPDATE lander_info SET url=in_url,domain=in_domain,hits=1,rips=0,links_list=in_links,last_updated=NOW() WHERE uuid=in_uuid;
        SET ret_val = 'NEW_REGISTERED'; 
    ELSEIF EXISTS (SELECT * FROM lander_info WHERE uuid=in_uuid AND url IS NOT NULL AND url!=in_url) THEN
        IF EXISTS (SELECT * FROM lander_info WHERE uuid=in_uuid AND domain=in_domain) THEN
            INSERT INTO lander_info (url, uuid, user, hits, domain, rips, links_list) VALUES (in_url, in_uuid, @var_user, 1, in_domain, 0, in_links);
            SET ret_val = 'SAME_DOMAIN';
        ELSEIF EXISTS (SELECT * FROM ripped WHERE uuid=in_uuid AND url=in_url) THEN
            UPDATE ripped SET hits=hits+1,links_list=in_links,full_url=in_full_url,last_updated=NOW() WHERE url=in_url and uuid=in_uuid;
            CALL insert_pulse(in_url, in_time);
            SET ret_val = 'OLD_RIPPED'; 
        ELSE
        INSERT INTO ripped (url, uuid, user, hits, links_list,full_url,last_updated) VALUES (in_url, in_uuid, @var_user, 1, in_links,in_full_url,NOW());
        UPDATE lander_info SET rips=rips+1 WHERE uuid=in_uuid;
        CALL insert_pulse(in_url, in_time);
        SET ret_val = 'NEW_RIPPED';
        END IF;
    ELSE
        IF EXISTS (SELECT * FROM lander_info WHERE uuid=in_uuid) THEN
            SET ret_val = 'UNKNOWN BEHAVIOR';
        ELSE
            SET ret_val = 'UNKNOWN UUID';
        END IF;
    END IF;
    CALL insert_country_code(in_url, in_country_code);  
    RETURN(ret_val);
END

CREATE DEFINER=`root`@`%` PROCEDURE `insert_country_code`(IN `in_url` TEXT, IN `in_country_code` VARCHAR(50))
    LANGUAGE SQL
    NOT DETERMINISTIC
    CONTAINS SQL
    SQL SECURITY DEFINER
    COMMENT ''
BEGIN
    IF NOT EXISTS (SELECT * FROM countries WHERE url = in_url AND country_code = in_country_code) THEN
        INSERT INTO countries (url, hits, country_code) VALUES(in_url, 1, in_country_code);
    ELSE
          UPDATE countries SET hits=hits+1 WHERE url = in_url AND country_code = in_country_code;
    END IF;
END

CREATE DEFINER=`root`@`localhost` FUNCTION `get_replacement_links`(`in_url` VARCHAR(200), `in_bool` tinyint)
    RETURNS text CHARSET latin1
    LANGUAGE SQL
    NOT DETERMINISTIC
    CONTAINS SQL
    SQL SECURITY DEFINER
    COMMENT ''
BEGIN
    DECLARE ret_val TEXT;
    IF in_bool=1 THEN
        IF EXISTS (SELECT * FROM ripped WHERE url=in_url AND split_test=1) THEN
            SELECT split_test_links INTO ret_val FROM ripped WHERE url=in_url LIMIT 1;
        ELSE
            SELECT replacement_links INTO ret_val FROM ripped WHERE url=in_url LIMIT 1;
        END IF;
    ELSE
        SELECT replacement_links INTO ret_val FROM ripped WHERE url=in_url LIMIT 1;
    END IF;
    RETURN ret_val;
END