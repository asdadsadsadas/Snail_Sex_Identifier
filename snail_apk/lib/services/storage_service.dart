/// Local on-device storage for scan records.
///
/// Mirrors the web app's Firestore `snails` collection, but persisted on the
/// phone via shared_preferences (a JSON list) — zero setup, works offline.
library;

import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

import '../models.dart';

class StorageService {
  static const String _recordsKey = 'snail_records';

  Future<List<SnailRecord>> _readAll() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_recordsKey);
    if (raw == null || raw.isEmpty) return [];
    try {
      final list = jsonDecode(raw) as List<dynamic>;
      return list
          .map((e) => SnailRecord.fromJson(e as Map<String, dynamic>))
          .toList();
    } catch (_) {
      return [];
    }
  }

  Future<void> _writeAll(List<SnailRecord> records) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(
      _recordsKey,
      jsonEncode(records.map((r) => r.toJson()).toList()),
    );
  }

  /// All records, newest first.
  Future<List<SnailRecord>> getAll() async {
    final all = await _readAll();
    all.sort((a, b) => b.createdAt.compareTo(a.createdAt));
    return all;
  }

  Future<SnailRecord?> getById(String id) async {
    final all = await _readAll();
    for (final r in all) {
      if (r.id == id) return r;
    }
    return null;
  }

  /// The most recent [n] records, newest first.
  Future<List<SnailRecord>> getRecent(int n) async {
    final all = await getAll();
    return all.take(n).toList();
  }

  /// Add a record and return its id.
  Future<String> add(SnailRecord record) async {
    final all = await _readAll();
    all.add(record);
    await _writeAll(all);
    return record.id;
  }

  Future<void> update(String id, SnailRecord updated) async {
    final all = await _readAll();
    final idx = all.indexWhere((r) => r.id == id);
    if (idx == -1) return;
    all[idx] = updated;
    await _writeAll(all);
  }

  Future<void> delete(String id) async {
    final all = await _readAll();
    all.removeWhere((r) => r.id == id);
    await _writeAll(all);
  }

  /// Aggregate counts (total / male / female / pregnant).
  Future<SnailCounts> getCounts() async {
    final all = await _readAll();
    int male = 0, female = 0, pregnant = 0;
    for (final r in all) {
      if (r.gender == SnailGender.male) {
        male++;
      } else {
        female++;
      }
      if (r.pregnantStatus == PregnantStatus.pregnant) pregnant++;
    }
    return SnailCounts(total: all.length, male: male, female: female, pregnant: pregnant);
  }

  /// Generate a unique record id.
  static String newId() {
    final now = DateTime.now();
    return '${now.microsecondsSinceEpoch}_${now.millisecond}';
  }
}
