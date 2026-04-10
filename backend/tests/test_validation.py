import pytest
import json
from utils.json_cleaner import clean_llm_json
from utils.node_validator import validate_and_repair_node

def test_json_cleaner_markdown():
    raw = "Here is the result:\n```json\n[{\"title\": \"Task 1\"}]\n```\nEnjoy!"
    cleaned = clean_llm_json(raw)
    assert cleaned == '[{"title": "Task 1"}]'

def test_json_cleaner_no_fences():
    raw = "[{\"title\": \"Task 1\"}]"
    cleaned = clean_llm_json(raw)
    assert cleaned == '[{"title": "Task 1"}]'

def test_node_validator_repairs_id_and_timestamps():
    unrepaired_node = {
        "title": "A Task",
        "type": "task",
        "parent_id": "P1",
        "summary": "Summary",
        "objective": "Objective",
        "risk": "low",
        "size": "small"
    }
    
    repaired = validate_and_repair_node(unrepaired_node)
    assert "id" in repaired
    assert len(repaired["id"]) > 10
    assert "created_at" in repaired
    assert "updated_at" in repaired
    assert repaired["last_decomposed_at"] is None
    assert repaired["scope"] == []

def test_node_validator_rejects_missing_title():
    with pytest.raises(ValueError, match="Missing required string field 'title'"):
        validate_and_repair_node({
            "type": "task",
            "parent_id": "P1",
            "summary": "Summary",
            "objective": "Objective",
            "risk": "low",
            "size": "small"
        })

def test_node_validator_repairs_leaf_task_without_commands():
    repaired = validate_and_repair_node({
        "title": "A Bug fix",
        "type": "leaf_task",
        "parent_id": "P1",
        "summary": "Summary",
        "objective": "Objective",
        "risk": "low",
        "size": "small",
        "success_criteria": [],
        "tests": [],
        "validation_commands": []
    })
    
    assert "Pending success criteria" in repaired["success_criteria"][0]
    assert "Pending tests" in repaired["tests"][0]
    assert "Pending validation commands" in repaired["validation_commands"][0]
