package com.writeloop.dto;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class PromptTaskMetaDtoTest {

    @Test
    void questionSpecificSlotContractsStayInternalToTheBackend() {
        PromptTaskMetaDto metadata = new PromptTaskMetaDto(
                "GENERAL_DESCRIPTION",
                List.of("PLACE"),
                List.of(),
                "PRESENT_SIMPLE",
                "FIRST_PERSON",
                0,
                Map.of(
                        "PLACE",
                        new PromptSlotContractDto(
                                "The learner's current residence.",
                                "The answer states where the learner currently lives.",
                                "Korean role reference.",
                                "Korean satisfaction reference."
                        )
                )
        );

        JsonNode json = new ObjectMapper().valueToTree(metadata);

        assertThat(json.has("slotContracts")).isFalse();
        assertThat(metadata.slotContracts()).containsKey("PLACE");
    }
}
