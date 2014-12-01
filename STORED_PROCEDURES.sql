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
CREATE PROCEDURE get_lander_id
(IN in_user VARCHAR(1000))
    BEGIN
    INSERT INTO lander_info (user) values (in_user);
    SELECT LAST_INSERT_ID() as id;
    END ; //
DELIMITER ;

