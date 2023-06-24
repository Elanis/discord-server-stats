--
-- PostgreSQL database dump
--

-- Dumped from database version 15.2
-- Dumped by pg_dump version 15.2

-- Started on 2023-06-24 22:33:23

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 216 (class 1259 OID 76993)
-- Name: channels; Type: TABLE; Schema: public; Owner: discordstats
--

CREATE TABLE public.channels (
    id character varying NOT NULL,
    name character varying NOT NULL,
    guild character varying NOT NULL
);


ALTER TABLE public.channels OWNER TO discordstats;

--
-- TOC entry 214 (class 1259 OID 76977)
-- Name: messages; Type: TABLE; Schema: public; Owner: discordstats
--

CREATE TABLE public.messages (
    id character varying NOT NULL,
    "createdTimestamp" bigint NOT NULL,
    type integer NOT NULL,
    content character varying NOT NULL,
    author character varying NOT NULL,
    channel character varying NOT NULL,
    guild character varying NOT NULL
);


ALTER TABLE public.messages OWNER TO discordstats;

--
-- TOC entry 215 (class 1259 OID 76984)
-- Name: users; Type: TABLE; Schema: public; Owner: discordstats
--

CREATE TABLE public.users (
    id character varying NOT NULL,
    bot boolean NOT NULL,
    system boolean NOT NULL,
    username character varying NOT NULL,
    discriminator character varying
);


ALTER TABLE public.users OWNER TO discordstats;

--
-- TOC entry 3188 (class 2606 OID 77033)
-- Name: channels channels_id_key; Type: CONSTRAINT; Schema: public; Owner: discordstats
--

ALTER TABLE ONLY public.channels
    ADD CONSTRAINT channels_id_key UNIQUE (id);


--
-- TOC entry 3190 (class 2606 OID 77005)
-- Name: channels channels_pkey; Type: CONSTRAINT; Schema: public; Owner: discordstats
--

ALTER TABLE ONLY public.channels
    ADD CONSTRAINT channels_pkey PRIMARY KEY (id, guild);


--
-- TOC entry 3184 (class 2606 OID 77001)
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: public; Owner: discordstats
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id, channel, guild);


--
-- TOC entry 3186 (class 2606 OID 77042)
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: discordstats
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- TOC entry 3191 (class 2606 OID 77043)
-- Name: messages messages_author_fkey; Type: FK CONSTRAINT; Schema: public; Owner: discordstats
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_author_fkey FOREIGN KEY (author) REFERENCES public.users(id) NOT VALID;


--
-- TOC entry 3192 (class 2606 OID 77034)
-- Name: messages messages_channel_fkey; Type: FK CONSTRAINT; Schema: public; Owner: discordstats
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_channel_fkey FOREIGN KEY (channel) REFERENCES public.channels(id) NOT VALID;


-- Completed on 2023-06-24 22:33:26

--
-- PostgreSQL database dump complete
--

