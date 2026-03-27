package com.writeloop;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class WriteLoopApplication {

    public static void main(String[] args) {
        SpringApplication.run(WriteLoopApplication.class, args);
    }
}
